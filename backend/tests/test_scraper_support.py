"""
Tests for the scraper retry / alert helpers.
"""

from __future__ import annotations

import pytest

from app.services import scraper_support


def test_with_retries_returns_value_on_first_success():
    calls = []
    def fn():
        calls.append(1)
        return "ok"
    assert scraper_support.with_retries(fn, label="t", attempts=3, base_delay=0) == "ok"
    assert len(calls) == 1


def test_with_retries_retries_then_succeeds():
    calls = {"n": 0}
    def fn():
        calls["n"] += 1
        if calls["n"] < 3:
            raise RuntimeError("transient")
        return "ok"
    assert scraper_support.with_retries(fn, label="t", attempts=5, base_delay=0) == "ok"
    assert calls["n"] == 3


def test_with_retries_reraises_after_exhausting_attempts():
    calls = {"n": 0}
    def fn():
        calls["n"] += 1
        raise RuntimeError("permanent")
    with pytest.raises(RuntimeError, match="permanent"):
        scraper_support.with_retries(fn, label="t", attempts=3, base_delay=0)
    assert calls["n"] == 3
