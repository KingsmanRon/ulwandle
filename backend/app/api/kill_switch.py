"""
Kill Switch API - Remote Valve Control
Emergency valve control with employee notifications
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from pydantic import BaseModel

from app.db.database import get_db
from app.models.models import (
    Valve, ValveOperation, ValveStatus, District,
    Employee, Alert, AlertLevel
)
from app.core.config import settings
from app.services.claude_service import claude_service
from app.services.websocket_manager import websocket_manager

router = APIRouter()


class ValveCreate(BaseModel):
    valve_id: str
    name: str
    district_id: int
    location_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    can_auto_close: bool = False


class ValveOperationRequest(BaseModel):
    action: str  # "open", "close", "partial"
    operator_name: str
    reason: str
    is_manual: bool = True
    bypass_confirmation: bool = False


@router.get("/valves")
async def get_valves(
    district_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all valves with optional filters"""
    query = db.query(Valve)

    if district_id:
        query = query.filter(Valve.district_id == district_id)
    if status:
        query = query.filter(Valve.status == ValveStatus(status))

    valves = query.all()

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
                "latitude": v.latitude,
                "longitude": v.longitude
            }
            for v in valves
        ]
    }


@router.post("/valves")
async def create_valve(
    valve: ValveCreate,
    db: Session = Depends(get_db)
):
    """Register new valve"""
    # Check if valve already exists
    existing = db.query(Valve).filter(Valve.valve_id == valve.valve_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Valve already exists")

    # Verify district exists
    district = db.query(District).filter(District.id == valve.district_id).first()
    if not district:
        raise HTTPException(status_code=404, detail="District not found")

    new_valve = Valve(**valve.dict())
    db.add(new_valve)
    db.commit()
    db.refresh(new_valve)

    return {
        "message": "Valve registered successfully",
        "valve": {
            "id": new_valve.id,
            "valve_id": new_valve.valve_id,
            "name": new_valve.name,
            "district_id": new_valve.district_id
        }
    }


@router.get("/valves/{valve_id}")
async def get_valve_details(
    valve_id: str,
    db: Session = Depends(get_db)
):
    """Get detailed valve information"""
    valve = db.query(Valve).filter(Valve.valve_id == valve_id).first()
    if not valve:
        raise HTTPException(status_code=404, detail="Valve not found")

    # Get recent operations
    recent_ops = db.query(ValveOperation).filter(
        ValveOperation.valve_id == valve.id
    ).order_by(ValveOperation.executed_at.desc()).limit(10).all()

    district = db.query(District).filter(District.id == valve.district_id).first()

    return {
        "valve": {
            "id": valve.id,
            "valve_id": valve.valve_id,
            "name": valve.name,
            "district": {
                "id": district.id,
                "name": district.name,
                "municipality": district.municipality
            } if district else None,
            "location_name": valve.location_name,
            "status": valve.status.value,
            "is_remote_controlled": valve.is_remote_controlled,
            "requires_confirmation": valve.requires_confirmation,
            "can_auto_close": valve.can_auto_close,
            "last_operated_at": valve.last_operated_at.isoformat() if valve.last_operated_at else None,
            "latitude": valve.latitude,
            "longitude": valve.longitude
        },
        "recent_operations": [
            {
                "action": op.action,
                "operator_name": op.operator_name,
                "reason": op.reason,
                "is_manual": op.is_manual,
                "executed_at": op.executed_at.isoformat()
            }
            for op in recent_ops
        ]
    }


@router.post("/valves/{valve_id}/operate")
async def operate_valve(
    valve_id: str,
    operation: ValveOperationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Execute valve operation (Kill Switch)
    This is the primary endpoint for emergency valve control
    """
    # Check if valve control is enabled
    if not settings.VALVE_CONTROL_ENABLED:
        raise HTTPException(
            status_code=403,
            detail="Valve control is disabled in system configuration"
        )

    # Get valve
    valve = db.query(Valve).filter(Valve.valve_id == valve_id).first()
    if not valve:
        raise HTTPException(status_code=404, detail="Valve not found")

    # Check if valve is remote controlled
    if not valve.is_remote_controlled:
        raise HTTPException(
            status_code=400,
            detail="This valve is not configured for remote control"
        )

    # Validate action
    if operation.action not in ["open", "close", "partial"]:
        raise HTTPException(status_code=400, detail="Invalid action. Must be: open, close, or partial")

    # Get district info
    district = db.query(District).filter(District.id == valve.district_id).first()

    # Get current system conditions for AI analysis
    current_conditions = {
        "valve_current_status": valve.status.value,
        "district_name": district.name if district else "Unknown",
        "district_population": district.population if district else 0,
        "district_water_quality_status": district.status.value if district else "unknown"
    }

    # Use Claude AI to analyze the operation (if not bypassed)
    if not operation.bypass_confirmation and settings.REQUIRE_MANUAL_CONFIRMATION:
        ai_analysis = await claude_service.analyze_valve_operation_decision(
            valve_name=valve.name,
            district_name=district.name if district else "Unknown",
            current_conditions=current_conditions,
            reason=operation.reason
        )

        # Check AI recommendation
        if ai_analysis.get("recommendation") == "deny":
            return {
                "status": "denied",
                "message": "Operation denied by AI safety system",
                "ai_analysis": ai_analysis,
                "manual_override_required": True
            }

    # Record previous status
    previous_status = valve.status.value

    # Execute valve operation
    new_status_map = {
        "open": ValveStatus.OPEN,
        "close": ValveStatus.CLOSED,
        "partial": ValveStatus.PARTIAL
    }
    new_status = new_status_map.get(operation.action)

    valve.status = new_status
    valve.last_operated_at = datetime.utcnow()

    # Create operation record (audit trail)
    valve_op = ValveOperation(
        valve_id=valve.id,
        action=operation.action,
        previous_status=previous_status,
        new_status=new_status.value,
        operator_name=operation.operator_name,
        reason=operation.reason,
        is_manual=operation.is_manual
    )

    db.add(valve_op)
    db.commit()
    db.refresh(valve_op)

    # Create alert
    alert_level = AlertLevel.CRITICAL if operation.action == "close" else AlertLevel.WARNING
    alert = Alert(
        district_id=valve.district_id,
        alert_type="valve",
        level=alert_level,
        title=f"Kill Switch Activated: {valve.name}",
        message=f"Valve {valve.name} has been {operation.action}ED by {operation.operator_name}. Reason: {operation.reason}",
        metadata={
            "valve_id": valve.valve_id,
            "action": operation.action,
            "operator": operation.operator_name,
            "reason": operation.reason
        }
    )
    db.add(alert)
    db.commit()

    # Notify employees in the district
    background_tasks.add_task(
        notify_employees,
        valve=valve,
        action=operation.action,
        district_name=district.name if district else "Unknown",
        reason=operation.reason,
        db=db
    )

    # Send WebSocket notification
    await websocket_manager.send_valve_notification(
        valve_id=valve.valve_id,
        action=operation.action,
        district_name=district.name if district else "Unknown"
    )

    return {
        "status": "success",
        "message": f"Valve {operation.action} operation completed successfully",
        "valve_id": valve.valve_id,
        "valve_name": valve.name,
        "action": operation.action,
        "previous_status": previous_status,
        "new_status": new_status.value,
        "operator": operation.operator_name,
        "timestamp": valve.last_operated_at.isoformat(),
        "operation_id": valve_op.id,
        "employees_notified": True
    }


@router.get("/valves/{valve_id}/operations")
async def get_valve_operations(
    valve_id: str,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Get operation history for a valve (audit trail)"""
    valve = db.query(Valve).filter(Valve.valve_id == valve_id).first()
    if not valve:
        raise HTTPException(status_code=404, detail="Valve not found")

    operations = db.query(ValveOperation).filter(
        ValveOperation.valve_id == valve.id
    ).order_by(ValveOperation.executed_at.desc()).limit(limit).all()

    return {
        "valve_id": valve_id,
        "valve_name": valve.name,
        "total_operations": len(operations),
        "operations": [
            {
                "id": op.id,
                "action": op.action,
                "previous_status": op.previous_status,
                "new_status": op.new_status,
                "operator_id": op.operator_id,
                "operator_name": op.operator_name,
                "reason": op.reason,
                "is_manual": op.is_manual,
                "executed_at": op.executed_at.isoformat()
            }
            for op in operations
        ]
    }


@router.post("/emergency-shutdown/{district_id}")
async def emergency_district_shutdown(
    district_id: int,
    operator_name: str,
    reason: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Emergency shutdown - close all valves in a district
    CRITICAL OPERATION - Use with extreme caution
    """
    # Get district
    district = db.query(District).filter(District.id == district_id).first()
    if not district:
        raise HTTPException(status_code=404, detail="District not found")

    # Get all valves in district
    valves = db.query(Valve).filter(
        Valve.district_id == district_id,
        Valve.is_remote_controlled == True
    ).all()

    if not valves:
        raise HTTPException(status_code=404, detail="No remote-controlled valves found in this district")

    closed_valves = []
    failed_valves = []

    # Close all valves
    for valve in valves:
        try:
            previous_status = valve.status.value
            valve.status = ValveStatus.CLOSED
            valve.last_operated_at = datetime.utcnow()

            # Create operation record
            valve_op = ValveOperation(
                valve_id=valve.id,
                action="close",
                previous_status=previous_status,
                new_status="closed",
                operator_name=operator_name,
                reason=f"EMERGENCY SHUTDOWN: {reason}",
                is_manual=True
            )
            db.add(valve_op)
            closed_valves.append(valve.valve_id)

        except Exception as e:
            failed_valves.append({
                "valve_id": valve.valve_id,
                "error": str(e)
            })

    db.commit()

    # Create critical alert
    alert = Alert(
        district_id=district_id,
        alert_type="emergency",
        level=AlertLevel.EMERGENCY,
        title=f"EMERGENCY DISTRICT SHUTDOWN: {district.name}",
        message=f"All valves in {district.name} have been closed by {operator_name}. Reason: {reason}",
        metadata={
            "valves_closed": closed_valves,
            "valves_failed": failed_valves,
            "operator": operator_name,
            "reason": reason
        }
    )
    db.add(alert)
    db.commit()

    # Notify all employees
    background_tasks.add_task(
        notify_all_employees,
        district_name=district.name,
        reason=reason,
        operator_name=operator_name,
        db=db
    )

    # Broadcast emergency notification
    await websocket_manager.broadcast(
        f"🚨 EMERGENCY SHUTDOWN: All valves in {district.name} have been closed. Reason: {reason}"
    )

    return {
        "status": "emergency_shutdown_completed",
        "district_id": district_id,
        "district_name": district.name,
        "valves_closed": len(closed_valves),
        "valves_failed": len(failed_valves),
        "closed_valve_ids": closed_valves,
        "failed_valves": failed_valves,
        "operator": operator_name,
        "reason": reason,
        "timestamp": datetime.utcnow().isoformat()
    }


async def notify_employees(
    valve: Valve,
    action: str,
    district_name: str,
    reason: str,
    db: Session
):
    """Background task to notify field employees"""
    # Get employees assigned to this district
    employees = db.query(Employee).filter(
        Employee.assigned_district_id == valve.district_id,
        Employee.is_active == True
    ).all()

    employee_ids = [e.employee_id for e in employees]

    if employees and settings.EMPLOYEE_NOTIFICATION_ENABLED:
        # Send WebSocket notifications
        await websocket_manager.send_valve_notification(
            valve_id=valve.valve_id,
            action=action,
            district_name=district_name,
            employees=employee_ids
        )

        # TODO: Send SMS/Email notifications here
        # This would integrate with your SMS/email service


async def notify_all_employees(
    district_name: str,
    reason: str,
    operator_name: str,
    db: Session
):
    """Notify all active employees of emergency shutdown"""
    employees = db.query(Employee).filter(Employee.is_active == True).all()

    message = f"🚨 EMERGENCY: District {district_name} shutdown by {operator_name}. Reason: {reason}"

    await websocket_manager.broadcast(message)

    # TODO: Send SMS/Email to all employees
