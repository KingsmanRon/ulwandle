"""
Water Monitoring API Endpoints
Real-time flow and pressure monitoring
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel

from app.db.database import get_db
from app.models.models import (
    Sensor, FlowReading, PressureReading,
    District, LeakDetection
)
from app.services.websocket_manager import websocket_manager

router = APIRouter()


class SensorCreate(BaseModel):
    sensor_id: str
    sensor_type: str
    district_id: int
    location_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class FlowReadingCreate(BaseModel):
    sensor_id: int
    flow_rate: float
    total_volume: Optional[float] = None


class PressureReadingCreate(BaseModel):
    sensor_id: int
    pressure: float


@router.get("/sensors")
async def get_sensors(
    district_id: Optional[int] = None,
    sensor_type: Optional[str] = None,
    is_active: bool = True,
    db: Session = Depends(get_db)
):
    """Get all sensors with optional filters"""
    query = db.query(Sensor)

    if district_id:
        query = query.filter(Sensor.district_id == district_id)
    if sensor_type:
        query = query.filter(Sensor.sensor_type == sensor_type)
    if is_active is not None:
        query = query.filter(Sensor.is_active == is_active)

    sensors = query.all()
    return {
        "count": len(sensors),
        "sensors": [
            {
                "id": s.id,
                "sensor_id": s.sensor_id,
                "sensor_type": s.sensor_type,
                "district_id": s.district_id,
                "location_name": s.location_name,
                "is_active": s.is_active,
                "last_reading_at": s.last_reading_at.isoformat() if s.last_reading_at else None
            }
            for s in sensors
        ]
    }


@router.post("/sensors")
async def create_sensor(
    sensor: SensorCreate,
    db: Session = Depends(get_db)
):
    """Register new sensor"""
    # Check if sensor already exists
    existing = db.query(Sensor).filter(Sensor.sensor_id == sensor.sensor_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Sensor already exists")

    # Verify district exists
    district = db.query(District).filter(District.id == sensor.district_id).first()
    if not district:
        raise HTTPException(status_code=404, detail="District not found")

    new_sensor = Sensor(**sensor.dict())
    db.add(new_sensor)
    db.commit()
    db.refresh(new_sensor)

    return {
        "message": "Sensor created successfully",
        "sensor": {
            "id": new_sensor.id,
            "sensor_id": new_sensor.sensor_id,
            "sensor_type": new_sensor.sensor_type
        }
    }


@router.post("/flow-readings")
async def add_flow_reading(
    reading: FlowReadingCreate,
    db: Session = Depends(get_db)
):
    """Add new flow reading from sensor"""
    # Verify sensor exists
    sensor = db.query(Sensor).filter(Sensor.id == reading.sensor_id).first()
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")

    # Create reading
    new_reading = FlowReading(**reading.dict())
    db.add(new_reading)

    # Update sensor last reading time
    sensor.last_reading_at = datetime.utcnow()

    db.commit()
    db.refresh(new_reading)

    # Check for anomalies (simple threshold check)
    await check_flow_anomaly(sensor, new_reading, db)

    return {
        "message": "Flow reading recorded",
        "reading_id": new_reading.id,
        "timestamp": new_reading.recorded_at.isoformat()
    }


@router.get("/flow-readings")
async def get_flow_readings(
    sensor_id: Optional[int] = None,
    district_id: Optional[int] = None,
    hours: int = Query(24, description="Hours of historical data"),
    db: Session = Depends(get_db)
):
    """Get flow readings with time filter"""
    time_threshold = datetime.utcnow() - timedelta(hours=hours)

    query = db.query(FlowReading).filter(FlowReading.recorded_at >= time_threshold)

    if sensor_id:
        query = query.filter(FlowReading.sensor_id == sensor_id)
    elif district_id:
        # Get all sensors in district
        sensors = db.query(Sensor).filter(Sensor.district_id == district_id).all()
        sensor_ids = [s.id for s in sensors]
        query = query.filter(FlowReading.sensor_id.in_(sensor_ids))

    readings = query.order_by(FlowReading.recorded_at.desc()).limit(1000).all()

    return {
        "count": len(readings),
        "timespan_hours": hours,
        "readings": [
            {
                "id": r.id,
                "sensor_id": r.sensor_id,
                "flow_rate": r.flow_rate,
                "total_volume": r.total_volume,
                "is_anomaly": r.is_anomaly,
                "recorded_at": r.recorded_at.isoformat()
            }
            for r in readings
        ]
    }


@router.post("/pressure-readings")
async def add_pressure_reading(
    reading: PressureReadingCreate,
    db: Session = Depends(get_db)
):
    """Add new pressure reading"""
    sensor = db.query(Sensor).filter(Sensor.id == reading.sensor_id).first()
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")

    new_reading = PressureReading(**reading.dict())
    db.add(new_reading)

    sensor.last_reading_at = datetime.utcnow()

    db.commit()
    db.refresh(new_reading)

    return {
        "message": "Pressure reading recorded",
        "reading_id": new_reading.id,
        "timestamp": new_reading.recorded_at.isoformat()
    }


@router.get("/pressure-readings")
async def get_pressure_readings(
    sensor_id: Optional[int] = None,
    district_id: Optional[int] = None,
    hours: int = Query(24, description="Hours of historical data"),
    db: Session = Depends(get_db)
):
    """Get pressure readings"""
    time_threshold = datetime.utcnow() - timedelta(hours=hours)

    query = db.query(PressureReading).filter(PressureReading.recorded_at >= time_threshold)

    if sensor_id:
        query = query.filter(PressureReading.sensor_id == sensor_id)
    elif district_id:
        sensors = db.query(Sensor).filter(Sensor.district_id == district_id).all()
        sensor_ids = [s.id for s in sensors]
        query = query.filter(PressureReading.sensor_id.in_(sensor_ids))

    readings = query.order_by(PressureReading.recorded_at.desc()).limit(1000).all()

    return {
        "count": len(readings),
        "timespan_hours": hours,
        "readings": [
            {
                "id": r.id,
                "sensor_id": r.sensor_id,
                "pressure": r.pressure,
                "recorded_at": r.recorded_at.isoformat()
            }
            for r in readings
        ]
    }


@router.get("/leaks")
async def get_leak_detections(
    district_id: Optional[int] = None,
    is_confirmed: Optional[bool] = None,
    is_repaired: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """Get detected leaks"""
    query = db.query(LeakDetection)

    if district_id:
        query = query.filter(LeakDetection.district_id == district_id)
    if is_confirmed is not None:
        query = query.filter(LeakDetection.is_confirmed == is_confirmed)
    if is_repaired is not None:
        query = query.filter(LeakDetection.is_repaired == is_repaired)

    leaks = query.order_by(LeakDetection.detected_at.desc()).all()

    return {
        "count": len(leaks),
        "leaks": [
            {
                "id": l.id,
                "district_id": l.district_id,
                "location_description": l.location_description,
                "estimated_loss_lpm": l.estimated_loss_lpm,
                "confidence_score": l.confidence_score,
                "is_confirmed": l.is_confirmed,
                "is_repaired": l.is_repaired,
                "detected_at": l.detected_at.isoformat()
            }
            for l in leaks
        ]
    }


@router.get("/statistics")
async def get_monitoring_statistics(
    district_id: Optional[int] = None,
    hours: int = Query(24, description="Hours for statistics"),
    db: Session = Depends(get_db)
):
    """Get monitoring statistics"""
    time_threshold = datetime.utcnow() - timedelta(hours=hours)

    # Get flow statistics
    flow_query = db.query(FlowReading).filter(FlowReading.recorded_at >= time_threshold)

    if district_id:
        sensors = db.query(Sensor).filter(Sensor.district_id == district_id).all()
        sensor_ids = [s.id for s in sensors]
        flow_query = flow_query.filter(FlowReading.sensor_id.in_(sensor_ids))

    flow_readings = flow_query.all()

    if flow_readings:
        flow_rates = [r.flow_rate for r in flow_readings]
        avg_flow = sum(flow_rates) / len(flow_rates)
        max_flow = max(flow_rates)
        min_flow = min(flow_rates)
        anomaly_count = sum(1 for r in flow_readings if r.is_anomaly)
    else:
        avg_flow = max_flow = min_flow = 0
        anomaly_count = 0

    # Get leak count
    leak_query = db.query(LeakDetection).filter(LeakDetection.detected_at >= time_threshold)
    if district_id:
        leak_query = leak_query.filter(LeakDetection.district_id == district_id)

    leak_count = leak_query.count()
    unrepaired_leaks = leak_query.filter(LeakDetection.is_repaired == False).count()

    return {
        "timespan_hours": hours,
        "district_id": district_id,
        "flow_statistics": {
            "readings_count": len(flow_readings),
            "average_flow_lpm": round(avg_flow, 2),
            "max_flow_lpm": round(max_flow, 2),
            "min_flow_lpm": round(min_flow, 2),
            "anomalies_detected": anomaly_count
        },
        "leak_statistics": {
            "total_leaks": leak_count,
            "unrepaired_leaks": unrepaired_leaks
        }
    }


async def check_flow_anomaly(sensor: Sensor, reading: FlowReading, db: Session):
    """Check if flow reading is anomalous"""
    # Get recent readings for comparison
    time_threshold = datetime.utcnow() - timedelta(hours=24)
    recent_readings = db.query(FlowReading).filter(
        FlowReading.sensor_id == sensor.id,
        FlowReading.recorded_at >= time_threshold
    ).all()

    if len(recent_readings) < 10:
        return  # Not enough data

    # Simple anomaly detection: check if flow is significantly different from average
    flow_rates = [r.flow_rate for r in recent_readings]
    avg_flow = sum(flow_rates) / len(flow_rates)
    std_dev = (sum((x - avg_flow) ** 2 for x in flow_rates) / len(flow_rates)) ** 0.5

    # Flag as anomaly if more than 3 standard deviations from mean
    if abs(reading.flow_rate - avg_flow) > 3 * std_dev:
        reading.is_anomaly = True
        reading.anomaly_score = abs(reading.flow_rate - avg_flow) / std_dev if std_dev > 0 else 0
        db.commit()

        # Send real-time alert
        await websocket_manager.broadcast(
            f"Anomaly detected: Sensor {sensor.sensor_id} - Flow rate: {reading.flow_rate} L/min"
        )
