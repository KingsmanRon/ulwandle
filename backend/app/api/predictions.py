"""
Predictive Analytics API
Claude AI-powered consumption predictions and pattern analysis
"""

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta
from pydantic import BaseModel

from app.db.database import get_db
from app.models.models import (
    District, FlowReading, Sensor, Prediction, LeakDetection,
    Alert, AlertLevel
)
from app.services.claude_service import claude_service
from app.services.websocket_manager import websocket_manager

router = APIRouter()


class PredictionRequest(BaseModel):
    district_id: int
    prediction_type: str  # "consumption", "leak", "demand"
    horizon: str = "24h"  # "1h", "24h", "7d", "30d"
    historical_hours: int = 168  # 7 days default


@router.post("/analyze")
async def analyze_consumption_patterns(
    request: PredictionRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Analyze consumption patterns using Claude AI
    This is the core predictive consumption endpoint
    """
    # Get district
    district = db.query(District).filter(District.id == request.district_id).first()
    if not district:
        raise HTTPException(status_code=404, detail="District not found")

    # Get flow sensors in district
    sensors = db.query(Sensor).filter(
        Sensor.district_id == request.district_id,
        Sensor.sensor_type == "flow",
        Sensor.is_active == True
    ).all()

    if not sensors:
        raise HTTPException(status_code=404, detail="No active flow sensors found in district")

    # Get historical flow data
    time_threshold = datetime.utcnow() - timedelta(hours=request.historical_hours)
    sensor_ids = [s.id for s in sensors]

    flow_readings = db.query(FlowReading).filter(
        FlowReading.sensor_id.in_(sensor_ids),
        FlowReading.recorded_at >= time_threshold
    ).order_by(FlowReading.recorded_at.desc()).limit(2000).all()

    if not flow_readings:
        raise HTTPException(status_code=404, detail="No flow data available for analysis")

    # Prepare data for Claude
    flow_data = [
        {
            "sensor_id": r.sensor_id,
            "flow_rate": r.flow_rate,
            "total_volume": r.total_volume,
            "timestamp": r.recorded_at.isoformat(),
            "is_anomaly": r.is_anomaly
        }
        for r in flow_readings
    ]

    # Calculate historical statistics
    historical_data = calculate_historical_stats(flow_readings, request.historical_hours)

    # Analyze with Claude AI
    analysis = await claude_service.analyze_consumption_patterns(
        district_name=district.name,
        flow_data=flow_data,
        historical_data=historical_data
    )

    # Save prediction to database
    prediction = Prediction(
        prediction_type=request.prediction_type,
        district_id=request.district_id,
        confidence_score=analysis.get("leak_detection", {}).get("confidence_score", 0.0),
        prediction_horizon=request.horizon,
        data_points_used=len(flow_data),
        features_analyzed={
            "sensors": len(sensors),
            "readings": len(flow_data),
            "timespan_hours": request.historical_hours
        },
        prediction_result=analysis,
        claude_analysis=str(analysis.get("summary", "")),
        valid_until=datetime.utcnow() + timedelta(hours=24)
    )

    db.add(prediction)
    db.commit()
    db.refresh(prediction)

    # Check for leaks and create alerts
    if analysis.get("leak_detection", {}).get("potential_leaks"):
        background_tasks.add_task(
            create_leak_alert,
            district_id=request.district_id,
            analysis=analysis,
            db=db
        )

    # Send prediction update via WebSocket
    await websocket_manager.send_prediction_update(
        district_id=request.district_id,
        district_name=district.name,
        prediction_data=analysis
    )

    return {
        "status": "success",
        "prediction_id": prediction.id,
        "district_id": request.district_id,
        "district_name": district.name,
        "analysis": analysis,
        "metadata": {
            "sensors_analyzed": len(sensors),
            "data_points": len(flow_data),
            "historical_hours": request.historical_hours,
            "prediction_horizon": request.horizon
        },
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/predictions")
async def get_predictions(
    district_id: Optional[int] = None,
    prediction_type: Optional[str] = None,
    hours: int = Query(24, description="Hours of predictions to retrieve"),
    db: Session = Depends(get_db)
):
    """Get historical predictions"""
    time_threshold = datetime.utcnow() - timedelta(hours=hours)

    query = db.query(Prediction).filter(
        Prediction.created_at >= time_threshold
    )

    if district_id:
        query = query.filter(Prediction.district_id == district_id)
    if prediction_type:
        query = query.filter(Prediction.prediction_type == prediction_type)

    predictions = query.order_by(Prediction.created_at.desc()).limit(100).all()

    return {
        "count": len(predictions),
        "timespan_hours": hours,
        "predictions": [
            {
                "id": p.id,
                "prediction_type": p.prediction_type,
                "district_id": p.district_id,
                "confidence_score": p.confidence_score,
                "prediction_horizon": p.prediction_horizon,
                "created_at": p.created_at.isoformat(),
                "valid_until": p.valid_until.isoformat() if p.valid_until else None,
                "summary": p.claude_analysis
            }
            for p in predictions
        ]
    }


@router.get("/predictions/{prediction_id}")
async def get_prediction_details(
    prediction_id: int,
    db: Session = Depends(get_db)
):
    """Get detailed prediction information"""
    prediction = db.query(Prediction).filter(Prediction.id == prediction_id).first()
    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction not found")

    district = db.query(District).filter(District.id == prediction.district_id).first()

    return {
        "prediction": {
            "id": prediction.id,
            "prediction_type": prediction.prediction_type,
            "district": {
                "id": district.id,
                "name": district.name,
                "municipality": district.municipality
            } if district else None,
            "confidence_score": prediction.confidence_score,
            "prediction_horizon": prediction.prediction_horizon,
            "data_points_used": prediction.data_points_used,
            "features_analyzed": prediction.features_analyzed,
            "prediction_result": prediction.prediction_result,
            "claude_analysis": prediction.claude_analysis,
            "created_at": prediction.created_at.isoformat(),
            "valid_until": prediction.valid_until.isoformat() if prediction.valid_until else None
        }
    }


@router.post("/forecast/{district_id}")
async def forecast_consumption(
    district_id: int,
    horizon: str = Query("24h", description="Forecast horizon: 1h, 24h, 7d, 30d"),
    db: Session = Depends(get_db)
):
    """
    Forecast water consumption for specific time horizons
    Uses AI to predict future demand
    """
    district = db.query(District).filter(District.id == district_id).first()
    if not district:
        raise HTTPException(status_code=404, detail="District not found")

    # Map horizon to hours
    horizon_map = {
        "1h": 1,
        "24h": 24,
        "7d": 168,
        "30d": 720
    }

    horizon_hours = horizon_map.get(horizon, 24)

    # Get recent consumption data
    time_threshold = datetime.utcnow() - timedelta(hours=168)  # 7 days
    sensors = db.query(Sensor).filter(
        Sensor.district_id == district_id,
        Sensor.sensor_type == "flow"
    ).all()

    sensor_ids = [s.id for s in sensors]
    flow_readings = db.query(FlowReading).filter(
        FlowReading.sensor_id.in_(sensor_ids),
        FlowReading.recorded_at >= time_threshold
    ).all()

    if not flow_readings:
        raise HTTPException(status_code=404, detail="Insufficient data for forecasting")

    # Prepare data
    flow_data = [
        {
            "flow_rate": r.flow_rate,
            "timestamp": r.recorded_at.isoformat()
        }
        for r in flow_readings
    ]

    historical_stats = calculate_historical_stats(flow_readings, 168)

    # Get AI forecast
    analysis = await claude_service.analyze_consumption_patterns(
        district_name=district.name,
        flow_data=flow_data,
        historical_data=historical_stats
    )

    predictions = analysis.get("predictions", {})

    return {
        "district_id": district_id,
        "district_name": district.name,
        "forecast_horizon": horizon,
        "forecast_hours": horizon_hours,
        "predictions": predictions,
        "peak_periods": predictions.get("peak_periods", []),
        "estimated_consumption": predictions.get(f"next_{horizon}", 0),
        "confidence": analysis.get("leak_detection", {}).get("confidence_score", 0),
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/patterns/{district_id}")
async def get_consumption_patterns(
    district_id: int,
    days: int = Query(7, description="Days of pattern data"),
    db: Session = Depends(get_db)
):
    """
    Get detailed consumption pattern analysis
    Identifies daily, weekly, and seasonal patterns
    """
    district = db.query(District).filter(District.id == district_id).first()
    if not district:
        raise HTTPException(status_code=404, detail="District not found")

    # Get flow data
    time_threshold = datetime.utcnow() - timedelta(days=days)
    sensors = db.query(Sensor).filter(
        Sensor.district_id == district_id,
        Sensor.sensor_type == "flow"
    ).all()

    sensor_ids = [s.id for s in sensors]
    flow_readings = db.query(FlowReading).filter(
        FlowReading.sensor_id.in_(sensor_ids),
        FlowReading.recorded_at >= time_threshold
    ).all()

    if not flow_readings:
        return {
            "district_id": district_id,
            "message": "No data available",
            "patterns": {}
        }

    # Calculate patterns
    patterns = {
        "daily": analyze_daily_pattern(flow_readings),
        "weekly": analyze_weekly_pattern(flow_readings),
        "hourly": analyze_hourly_pattern(flow_readings)
    }

    return {
        "district_id": district_id,
        "district_name": district.name,
        "analysis_days": days,
        "total_readings": len(flow_readings),
        "patterns": patterns,
        "timestamp": datetime.utcnow().isoformat()
    }


def calculate_historical_stats(flow_readings: list, hours: int) -> dict:
    """Calculate historical statistics from flow readings"""
    if not flow_readings:
        return {}

    flow_rates = [r.flow_rate for r in flow_readings]
    anomaly_count = sum(1 for r in flow_readings if r.is_anomaly)

    return {
        "timespan_hours": hours,
        "total_readings": len(flow_readings),
        "average_flow_lpm": round(sum(flow_rates) / len(flow_rates), 2),
        "max_flow_lpm": round(max(flow_rates), 2),
        "min_flow_lpm": round(min(flow_rates), 2),
        "anomalies_detected": anomaly_count,
        "anomaly_rate": round(anomaly_count / len(flow_readings) * 100, 2)
    }


def analyze_daily_pattern(flow_readings: list) -> dict:
    """Analyze daily consumption patterns"""
    if not flow_readings:
        return {}

    # Group by day
    daily_consumption = {}
    for reading in flow_readings:
        day = reading.recorded_at.strftime("%Y-%m-%d")
        if day not in daily_consumption:
            daily_consumption[day] = []
        daily_consumption[day].append(reading.flow_rate)

    # Calculate averages
    daily_averages = {
        day: sum(rates) / len(rates)
        for day, rates in daily_consumption.items()
    }

    return {
        "days_analyzed": len(daily_averages),
        "average_daily_consumption": round(sum(daily_averages.values()) / len(daily_averages), 2),
        "peak_day": max(daily_averages, key=daily_averages.get),
        "lowest_day": min(daily_averages, key=daily_averages.get)
    }


def analyze_weekly_pattern(flow_readings: list) -> dict:
    """Analyze weekly consumption patterns"""
    if not flow_readings:
        return {}

    # Group by day of week (0=Monday, 6=Sunday)
    weekly_consumption = {i: [] for i in range(7)}
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    for reading in flow_readings:
        day_of_week = reading.recorded_at.weekday()
        weekly_consumption[day_of_week].append(reading.flow_rate)

    # Calculate averages
    weekly_averages = {}
    for day_num, rates in weekly_consumption.items():
        if rates:
            weekly_averages[day_names[day_num]] = round(sum(rates) / len(rates), 2)

    return {
        "weekly_averages": weekly_averages,
        "peak_day": max(weekly_averages, key=weekly_averages.get) if weekly_averages else None,
        "lowest_day": min(weekly_averages, key=weekly_averages.get) if weekly_averages else None
    }


def analyze_hourly_pattern(flow_readings: list) -> dict:
    """Analyze hourly consumption patterns"""
    if not flow_readings:
        return {}

    # Group by hour (0-23)
    hourly_consumption = {i: [] for i in range(24)}

    for reading in flow_readings:
        hour = reading.recorded_at.hour
        hourly_consumption[hour].append(reading.flow_rate)

    # Calculate averages
    hourly_averages = {}
    for hour, rates in hourly_consumption.items():
        if rates:
            hourly_averages[f"{hour:02d}:00"] = round(sum(rates) / len(rates), 2)

    peak_hour = max(hourly_averages, key=hourly_averages.get) if hourly_averages else None
    low_hour = min(hourly_averages, key=hourly_averages.get) if hourly_averages else None

    return {
        "hourly_averages": hourly_averages,
        "peak_hour": peak_hour,
        "low_demand_hour": low_hour
    }


async def create_leak_alert(district_id: int, analysis: dict, db: Session):
    """Create leak detection alert"""
    district = db.query(District).filter(District.id == district_id).first()
    if not district:
        return

    leak_data = analysis.get("leak_detection", {})

    if leak_data.get("potential_leaks"):
        # Create leak detection record
        leak = LeakDetection(
            district_id=district_id,
            location_description=f"AI-detected potential leak in {district.name}",
            estimated_loss_lpm=leak_data.get("estimated_loss_lpm", 0),
            confidence_score=leak_data.get("confidence_score", 0),
            detection_method="ai",
            is_confirmed=False
        )
        db.add(leak)

        # Create alert
        alert = Alert(
            district_id=district_id,
            alert_type="leak",
            level=AlertLevel.WARNING,
            title=f"Potential Leak Detected - {district.name}",
            message=f"AI analysis detected potential water leak. Estimated loss: {leak_data.get('estimated_loss_lpm', 0)} L/min. Confidence: {leak_data.get('confidence_score', 0)*100}%",
            metadata={"leak_data": leak_data}
        )
        db.add(alert)
        db.commit()

        # Send WebSocket notification
        await websocket_manager.send_leak_detection(
            district_id=district_id,
            district_name=district.name,
            leak_data=leak_data
        )
