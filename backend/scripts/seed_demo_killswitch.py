"""
Seed a demo district + remote-controlled valve so the dual-control kill switch
can be shown end-to-end.

The kill switch operates on a ``Valve`` that must be ``is_remote_controlled``
and attached to a ``District`` (the AI advisory reads district context). The
metro seed doesn't create districts/valves, so a fresh deploy has nothing to
demo. This script fixes that, idempotently.

Run (Render Shell, or locally against the target DB):
    python -m scripts.seed_demo_killswitch

Showcase steps (admin):
    1. Enable valve control for the showcase environment:
         VALVE_CONTROL_ENABLED=true   (env var; restart/redeploy to apply)
       It ships disabled by construction — this is a deliberate, explicit flip,
       not a runtime toggle, so it can't be turned on by accident or by the API.
    2. Provision two users (dual control requires proposer != approver):
         - an OPERATOR (or higher) to propose
         - a SUPERVISOR or ADMIN to approve
       Create them via POST /api/v1/auth/users (admin) or scripts.bootstrap_admin.
    3. Each user registers an Ed25519 signing key in the UI (Signing Key setup
       -> PUT /api/v1/auth/me/signing-key).
    4. Operator proposes an action on valve DEMO-VALVE-01; supervisor approves.
       The signed, TTL'd, audited operation executes. Done.
"""

from __future__ import annotations

from app.db.database import SessionLocal
from app.models.models import District, DistrictStatus, Valve, ValveStatus

DEMO_DISTRICT_CODE = "DEMO"
DEMO_VALVE_ID = "DEMO-VALVE-01"


def main() -> int:
    db = SessionLocal()
    try:
        district = db.query(District).filter(District.code == DEMO_DISTRICT_CODE).first()
        if district is None:
            district = District(
                name="Demo District (showcase)",
                code=DEMO_DISTRICT_CODE,
                municipality="City of Cape Town",
                province="Western Cape",
                population=50_000,
                status=DistrictStatus.UNMONITORED,
                latitude=-33.9249,
                longitude=18.4241,
            )
            db.add(district)
            db.flush()
            print(f"created demo district id={district.id} code={DEMO_DISTRICT_CODE}")
        else:
            print(f"demo district already present id={district.id}")

        valve = db.query(Valve).filter(Valve.valve_id == DEMO_VALVE_ID).first()
        if valve is None:
            valve = Valve(
                valve_id=DEMO_VALVE_ID,
                name="Demo Trunk-Main Valve",
                district_id=district.id,
                location_name="Demo Reservoir Outlet",
                status=ValveStatus.OPEN,
                is_remote_controlled=True,
                can_auto_close=False,
                requires_confirmation=True,
                latitude=-33.9249,
                longitude=18.4241,
            )
            db.add(valve)
            print(f"created demo valve {DEMO_VALVE_ID} (remote-controlled)")
        else:
            # Make sure it stays demoable even if toggled off previously.
            valve.is_remote_controlled = True
            valve.district_id = district.id
            print(f"demo valve {DEMO_VALVE_ID} already present — ensured remote-controlled")

        db.commit()
        print("Done. Enable VALVE_CONTROL_ENABLED=true to run the dual-control flow.")
        return 0
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
