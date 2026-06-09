"""
Unit tests for the dam-reading staleness helper that drives the STALE badge and
the recommendations max-age floor.
"""

from datetime import datetime, timedelta, timezone

from app.api import metros


def test_age_counts_whole_days():
    reading = datetime.now(timezone.utc) - timedelta(days=3, hours=2)
    assert metros._reading_age_days(reading) == 3


def test_fresh_reading_is_zero_days():
    assert metros._reading_age_days(datetime.now(timezone.utc)) == 0


def test_naive_datetime_treated_as_utc():
    naive = (datetime.now(timezone.utc) - timedelta(days=20)).replace(tzinfo=None)
    assert metros._reading_age_days(naive) >= 19
