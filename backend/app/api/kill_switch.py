"""
Kill Switch — dual-control, cryptographically authorized valve operations.

Workflow:
    1) Operator A creates a Proposal with a detached Ed25519 signature over
       a canonical message. Server verifies, stores, attaches AI advisory.
    2) Operator B (≠ A) approves with a separate signature over a binding
       message that includes the proposer's id. Server verifies and executes
       the operation atomically: updates valve state, writes immutable
       ValveOperation record, emits notifications.
    3) Proposals expire automatically after PROPOSAL_TTL_SECONDS.

The AI advisory is NEVER consulted to authorize execution.
"""

import asyncio
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_roles
from app.auth.security import canonical_op_message, verify_ed25519, hash_ip
from app.core.config import settings
from app.db.database import db_session, get_db
from app.models.models import (
    Alert, AlertLevel, AuditLog, District, Employee, ProposalStatus,
    ReasonCode, UsedNonce, User, UserRole, Valve, ValveOperation,
    ValveOperationProposal, ValveStatus,
)
from app.observability.metrics import ALERTS_CREATED_TOTAL, VALVE_OPERATIONS_TOTAL
from app.services.claude_service import claude_service
from app.services.notifications import dispatch_alert
from app.services.websocket_manager import websocket_manager

router = APIRouter()

VALID_ACTIONS = {"open", "close", "partial"}


# ---------- Schemas ----------

class ValveCreate(BaseModel):
    valve_id: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=100)
    district_id: int
    location_name: Optional[str] = Field(default=None, max_length=200)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    can_auto_close: bool = False


class ProposalCreate(BaseModel):
    valve_id: str = Field(min_length=1, max_length=50)
    action: str
    reason_code: ReasonCode
    reason_notes: Optional[str] = Field(default=None, max_length=1000)
    nonce: str = Field(min_length=16, max_length=128)
    issued_at: str = Field(min_length=10, max_length=40)
    signature: str = Field(min_length=64, max_length=200)

    @field_validator("action")
    @classmethod
    def _action_ok(cls, v: str) -> str:
        if v not in VALID_ACTIONS:
            raise ValueError(f"action must be one of {sorted(VALID_ACTIONS)}")
        return v


class ProposalApprove(BaseModel):
    signature: str = Field(min_length=64, max_length=200)


# ---------- Helpers ----------

def _check_enabled() -> None:
    if not settings.VALVE_CONTROL_ENABLED:
        raise HTTPException(503, "Valve control is disabled by configuration")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_iso(s: str) -> datetime:
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(400, "issued_at must be ISO-8601")


def _audit(db: Session, *, actor: User | None, action: str,
           resource_id: str | None, payload: dict, request: Request) -> None:
    ip = request.client.host if request.client else None
    db.add(AuditLog(
        actor_id=actor.id if actor else None,
        actor_email=actor.email if actor else None,
        action=action,
        resource_type="valve",
        resource_id=resource_id,
        payload=payload,
        ip_hash=hash_ip(ip) if ip else None,
    ))


def _consume_nonce(db: Session, nonce: str) -> None:
    """Single-use nonce check, with expiry to bound DB growth."""
    if db.query(UsedNonce).filter(UsedNonce.nonce == nonce).first():
        raise HTTPException(400, "Nonce already used")
    db.add(UsedNonce(
        nonce=nonce,
        expires_at=_now().replace(microsecond=0) + _ttl_replay(),
    ))


def _ttl_replay():
    from datetime import timedelta
    return timedelta(seconds=settings.NONCE_REPLAY_WINDOW_SECONDS)


# ---------- Read endpoints (any authenticated user) ----------

@router.get("/valves")
def list_valves(
    district_id: int | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    q = db.query(Valve)
    if district_id is not None:
        q = q.filter(Valve.district_id == district_id)
    valves = q.all()
    return {
        "count": len(valves),
        "valves": [
            {
                "id": v.id,
                "valve_id": v.valve_id,
                "name": v.name,
                "district_id": v.district_id,
                "location_name": v.location_name,
                "status": v.status.value,
                "is_remote_controlled": v.is_remote_controlled,
                "last_operated_at": v.last_operated_at.isoformat() if v.last_operated_at else None,
            }
            for v in valves
        ],
    }


@router.get("/valves/{valve_id}")
def get_valve(valve_id: str, db: Session = Depends(get_db),
              _user: User = Depends(get_current_user)):
    valve = db.query(Valve).filter(Valve.valve_id == valve_id).first()
    if not valve:
        raise HTTPException(404, "Valve not found")
    return {
        "id": valve.id,
        "valve_id": valve.valve_id,
        "name": valve.name,
        "status": valve.status.value,
        "district_id": valve.district_id,
    }


# ---------- Provisioning (admin) ----------

@router.post("/valves", status_code=201)
def create_valve(body: ValveCreate, request: Request,
                 current: User = Depends(require_roles(UserRole.ADMIN)),
                 db: Session = Depends(get_db)):
    if db.query(Valve).filter(Valve.valve_id == body.valve_id).first():
        raise HTTPException(409, "Valve already exists")
    if not db.query(District).filter(District.id == body.district_id).first():
        raise HTTPException(404, "District not found")
    valve = Valve(**body.model_dump())
    db.add(valve)
    db.flush()
    _audit(db, actor=current, action="valve.created",
           resource_id=valve.valve_id, payload=body.model_dump(), request=request)
    db.commit()
    db.refresh(valve)
    return {"id": valve.id, "valve_id": valve.valve_id, "name": valve.name}


# ---------- Dual-control proposal/approval ----------

@router.post("/proposals", status_code=201)
async def create_proposal(
    body: ProposalCreate,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles(UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN)),
):
    _check_enabled()
    if not current.ed25519_public_key:
        raise HTTPException(400, "Operator has no signing key registered. Provision a key first.")

    valve = db.query(Valve).filter(Valve.valve_id == body.valve_id).first()
    if not valve:
        raise HTTPException(404, "Valve not found")
    if not valve.is_remote_controlled:
        raise HTTPException(400, "Valve is not remote-controlled")

    issued_at = _parse_iso(body.issued_at)
    if abs((_now() - issued_at).total_seconds()) > settings.NONCE_REPLAY_WINDOW_SECONDS:
        raise HTTPException(400, "issued_at outside acceptable skew window")

    # Verify proposer signature.
    msg = canonical_op_message(
        body.valve_id, body.action, body.nonce, body.issued_at, role="propose"
    )
    if not verify_ed25519(current.ed25519_public_key, body.signature, msg):
        raise HTTPException(400, "Invalid signature")

    _consume_nonce(db, body.nonce)

    # Build advisory from sanitized inputs only.
    district = db.query(District).filter(District.id == valve.district_id).first()
    advisory = await claude_service.advise_valve_operation(
        valve_summary={
            "valve_name": valve.name,
            "district_name": district.name if district else "unknown",
            "district_population": district.population if district else 0,
            "current_status": valve.status.value,
            "district_quality_status": district.status.value if district else "unknown",
        },
        reason_code=body.reason_code.value,
    )

    proposal = ValveOperationProposal(
        valve_id=valve.id,
        action=body.action,
        reason_code=body.reason_code,
        reason_notes=body.reason_notes,
        nonce=body.nonce,
        issued_at=issued_at,
        proposer_id=current.id,
        proposer_signature=body.signature,
        ai_advisory=advisory,
        expires_at=_now() + _proposal_ttl(),
        status=ProposalStatus.PENDING,
    )
    db.add(proposal)
    db.flush()
    _audit(db, actor=current, action="proposal.created",
           resource_id=valve.valve_id,
           payload={"proposal_id": proposal.id, "action": body.action,
                    "reason_code": body.reason_code.value}, request=request)
    db.commit()
    db.refresh(proposal)

    return _proposal_view(proposal, valve, advisory)


@router.get("/proposals")
def list_proposals(
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.ADMIN)),
):
    q = db.query(ValveOperationProposal)
    if status_filter:
        try:
            q = q.filter(ValveOperationProposal.status == ProposalStatus(status_filter))
        except ValueError:
            raise HTTPException(400, "Invalid status filter")
    items = q.order_by(ValveOperationProposal.created_at.desc()).limit(200).all()
    valve_ids = {p.valve_id for p in items}
    valves = {v.id: v for v in db.query(Valve).filter(Valve.id.in_(valve_ids)).all()}
    return {
        "count": len(items),
        "proposals": [_proposal_summary(p, valves.get(p.valve_id)) for p in items],
    }


@router.post("/proposals/{proposal_id}/approve")
async def approve_proposal(
    proposal_id: int,
    body: ProposalApprove,
    request: Request,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles(UserRole.SUPERVISOR, UserRole.ADMIN)),
):
    _check_enabled()
    if not current.ed25519_public_key:
        raise HTTPException(400, "Approver has no signing key registered")

    proposal = db.query(ValveOperationProposal).filter(
        ValveOperationProposal.id == proposal_id
    ).with_for_update().first()
    if not proposal:
        raise HTTPException(404, "Proposal not found")
    if proposal.status != ProposalStatus.PENDING:
        raise HTTPException(409, f"Proposal is {proposal.status.value}, not pending")
    if proposal.expires_at < _now():
        proposal.status = ProposalStatus.EXPIRED
        db.commit()
        raise HTTPException(410, "Proposal expired")
    if proposal.proposer_id == current.id:
        raise HTTPException(403, "Approver must differ from proposer")

    valve = db.query(Valve).filter(Valve.id == proposal.valve_id).first()
    if not valve:
        raise HTTPException(404, "Valve not found")

    # Approver signs a binding message including proposer_id, so a signature
    # from a different context cannot be replayed.
    msg = canonical_op_message(
        valve.valve_id, proposal.action, proposal.nonce,
        proposal.issued_at.isoformat(), role="approve",
        proposer_id=proposal.proposer_id,
    )
    if not verify_ed25519(current.ed25519_public_key, body.signature, msg):
        raise HTTPException(400, "Invalid approver signature")

    # ---- Atomic execution ----
    previous_status = valve.status.value
    new_status = {
        "open": ValveStatus.OPEN,
        "close": ValveStatus.CLOSED,
        "partial": ValveStatus.PARTIAL,
    }[proposal.action]

    valve.status = new_status
    valve.last_operated_at = _now()

    proposal.approver_id = current.id
    proposal.approver_signature = body.signature
    proposal.status = ProposalStatus.EXECUTED
    proposal.decided_at = _now()
    proposal.executed_at = _now()

    op = ValveOperation(
        valve_id=valve.id,
        proposal_id=proposal.id,
        action=proposal.action,
        previous_status=previous_status,
        new_status=new_status.value,
        proposer_id=proposal.proposer_id,
        approver_id=current.id,
        proposer_signature=proposal.proposer_signature,
        approver_signature=body.signature,
        reason_code=proposal.reason_code,
        reason_notes=proposal.reason_notes,
    )
    db.add(op)

    alert_level = AlertLevel.CRITICAL if proposal.action == "close" else AlertLevel.WARNING
    alert = Alert(
        district_id=valve.district_id,
        alert_type="valve",
        level=alert_level,
        title=f"Valve operation executed: {valve.name}",
        message=f"Valve {valve.name} {proposal.action} (reason: {proposal.reason_code.value})",
        alert_metadata={
            "valve_id": valve.valve_id,
            "action": proposal.action,
            "proposer_id": proposal.proposer_id,
            "approver_id": current.id,
            "proposal_id": proposal.id,
        },
    )
    db.add(alert)
    _audit(db, actor=current, action="valve.executed",
           resource_id=valve.valve_id,
           payload={"proposal_id": proposal.id, "action": proposal.action,
                    "previous_status": previous_status, "new_status": new_status.value},
           request=request)
    db.commit()
    db.refresh(valve)
    db.refresh(alert)

    try:
        ALERTS_CREATED_TOTAL.labels(alert.alert_type, alert.level.value).inc()
        VALVE_OPERATIONS_TOTAL.labels(proposal.action).inc()
    except Exception:
        pass

    background.add_task(_post_execute_notify,
                        valve_id=valve.valve_id,
                        district_id=valve.district_id,
                        action=proposal.action)
    background.add_task(_dispatch_alert_safe, alert_id=alert.id)

    return {
        "status": "executed",
        "proposal_id": proposal.id,
        "valve_id": valve.valve_id,
        "action": proposal.action,
        "previous_status": previous_status,
        "new_status": new_status.value,
        "executed_at": proposal.executed_at.isoformat(),
    }


@router.post("/proposals/{proposal_id}/reject")
def reject_proposal(
    proposal_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles(UserRole.SUPERVISOR, UserRole.ADMIN)),
):
    proposal = db.query(ValveOperationProposal).filter(
        ValveOperationProposal.id == proposal_id
    ).first()
    if not proposal:
        raise HTTPException(404, "Proposal not found")
    if proposal.status != ProposalStatus.PENDING:
        raise HTTPException(409, "Proposal not pending")
    proposal.status = ProposalStatus.REJECTED
    proposal.decided_at = _now()
    proposal.approver_id = current.id
    _audit(db, actor=current, action="proposal.rejected",
           resource_id=str(proposal.valve_id),
           payload={"proposal_id": proposal.id}, request=request)
    db.commit()
    return {"status": "rejected", "proposal_id": proposal.id}


# ---------- Audit-trail read ----------

@router.get("/valves/{valve_id}/operations")
def operations_for_valve(
    valve_id: str,
    limit: int = 50,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    valve = db.query(Valve).filter(Valve.valve_id == valve_id).first()
    if not valve:
        raise HTTPException(404, "Valve not found")
    ops = (
        db.query(ValveOperation)
        .filter(ValveOperation.valve_id == valve.id)
        .order_by(ValveOperation.executed_at.desc())
        .limit(min(max(limit, 1), 500))
        .all()
    )
    return {
        "valve_id": valve_id,
        "valve_name": valve.name,
        "operations": [
            {
                "id": o.id,
                "action": o.action,
                "previous_status": o.previous_status,
                "new_status": o.new_status,
                "proposer_id": o.proposer_id,
                "approver_id": o.approver_id,
                "reason_code": o.reason_code.value,
                "executed_at": o.executed_at.isoformat(),
            }
            for o in ops
        ],
    }


# ---------- Background tasks ----------

async def _dispatch_alert_safe(alert_id: int) -> None:
    """Send an alert via the configured notification channels.

    Runs outside the request lifecycle so SMTP latency doesn't add to the
    approve-valve response time. Failures are swallowed.
    """
    try:
        with db_session() as db:
            alert = db.query(Alert).filter(Alert.id == alert_id).first()
            if alert is not None:
                dispatch_alert(alert)
    except Exception:
        import logging
        logging.getLogger(__name__).exception("alert dispatch failed (id=%s)", alert_id)


async def _post_execute_notify(valve_id: str, district_id: int | None, action: str) -> None:
    try:
        with db_session() as db:
            district = db.query(District).filter(District.id == district_id).first() if district_id else None
            employees = []
            if district:
                employees = db.query(Employee).filter(
                    Employee.assigned_district_id == district.id,
                    Employee.is_active == True,  # noqa: E712
                ).all()
        await websocket_manager.send_valve_notification(
            valve_id=valve_id,
            action=action,
            district_name=district.name if district else "unknown",
            employee_ids=[e.employee_id for e in employees] if employees else None,
        )
    except Exception:
        # Never let notification failures crash the executor; the operation is committed.
        import logging
        logging.getLogger(__name__).exception("Post-execute notification failed")


def _proposal_ttl():
    from datetime import timedelta
    return timedelta(seconds=settings.PROPOSAL_TTL_SECONDS)


def _proposal_view(p: ValveOperationProposal, v: Valve, advisory: dict) -> dict:
    canonical_approve = (
        "v1|approve|" + v.valve_id + "|" + p.action + "|" +
        p.nonce + "|" + p.issued_at.isoformat() + "|" + str(p.proposer_id)
    )
    return {
        "id": p.id,
        "valve_id": p.valve_id,
        "valve_string_id": v.valve_id,
        "valve_name": v.name,
        "action": p.action,
        "reason_code": p.reason_code.value,
        "status": p.status.value,
        "proposer_id": p.proposer_id,
        "nonce": p.nonce,
        "issued_at": p.issued_at.isoformat(),
        "expires_at": p.expires_at.isoformat(),
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "ai_advisory": advisory,
        "canonical_approver_message": canonical_approve,
    }


def _proposal_summary(p: ValveOperationProposal, valve: Valve | None) -> dict:
    """
    Returns enough context (nonce, issued_at, proposer_id, the valve string
    id) for an approver to reconstruct the canonical approver message
    offline. Disclosure is safe: the bytes alone cannot forge a signature.
    """
    valve_str = valve.valve_id if valve else ""
    canonical = (
        "v1|approve|" + valve_str + "|" + p.action + "|" +
        p.nonce + "|" + p.issued_at.isoformat() + "|" + str(p.proposer_id)
    )
    return {
        "id": p.id,
        "valve_id": p.valve_id,
        "valve_string_id": valve_str,
        "valve_name": valve.name if valve else None,
        "action": p.action,
        "reason_code": p.reason_code.value,
        "status": p.status.value,
        "proposer_id": p.proposer_id,
        "approver_id": p.approver_id,
        "nonce": p.nonce,
        "issued_at": p.issued_at.isoformat(),
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "expires_at": p.expires_at.isoformat(),
        "canonical_approver_message": canonical,
    }
