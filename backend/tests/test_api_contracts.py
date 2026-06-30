"""Regression tests for frontend-facing API contracts."""

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from app.api.predictions import _prediction_view
from app.api.water_quality import (
    WaterQualityCreate,
    _build_compliance_summary,
    _classify_reading,
)
from app.models.models import (
    District,
    DistrictStatus,
    Prediction,
    WaterQualityReading,
)


def test_prediction_view_uses_documented_field_names():
    prediction = Prediction(
        id=7,
        prediction_type="demand",
        district_id=3,
        confidence_score=0.82,
        prediction_horizon="24h",
        claude_analysis="Advisory summary",
        created_at=datetime(2026, 6, 30, tzinfo=timezone.utc),
    )

    result = _prediction_view(prediction)

    assert result == {
        "id": 7,
        "prediction_type": "demand",
        "district_id": 3,
        "confidence_score": 0.82,
        "prediction_horizon": "24h",
        "created_at": "2026-06-30T00:00:00+00:00",
        "summary": "Advisory summary",
    }


def test_water_quality_summary_keeps_unmonitored_distinct_from_green():
    unmonitored = District(
        id=1,
        name="No telemetry",
        code="NONE",
        municipality="Example Metro",
        province="Gauteng",
        status=DistrictStatus.UNMONITORED,
    )
    green = District(
        id=2,
        name="Passing reading",
        code="PASS",
        municipality="Example Metro",
        province="Gauteng",
        status=DistrictStatus.GREEN,
    )
    reading = WaterQualityReading(
        id=11,
        district_id=2,
        ph=7.2,
        tds=350,
        meets_sans_241=True,
        recorded_at=datetime(2026, 6, 30, tzinfo=timezone.utc),
    )

    result = _build_compliance_summary(
        [unmonitored, green],
        {green.id: reading},
    )

    assert result["total_districts"] == 2
    assert result["status_counts"] == {
        "unmonitored": 1,
        "green": 1,
        "yellow": 0,
        "red": 0,
    }
    assert result["districts"][0]["latest_reading"] is None
    assert result["districts"][1]["latest_reading"]["meets_standards"] is True


def test_water_quality_reading_requires_at_least_one_measurement():
    with pytest.raises(ValidationError):
        WaterQualityCreate(district_id=1)


def test_chlorine_breach_is_not_classified_green():
    status, violations = _classify_reading(
        WaterQualityCreate(district_id=1, chlorine=0.1),
    )

    assert status == DistrictStatus.YELLOW
    assert violations == ["Chlorine out of range: 0.1"]
