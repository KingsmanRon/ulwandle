"""
Regression tests for the DWS Weekly State of Dams parser.

We test the text layer (``_extract_readings_from_text``) against a representative
fixture rather than a binary PDF — the pdfplumber call is a thin text extractor,
and the fragile, format-dependent logic is the per-line parsing: matching stable
station codes, taking the LAST decimal as "Today %Full", stripping the "#"
latest-data marker, and reading the cover ISO date. If the Weekly.pdf layout or
station codes change, CI fails here.
"""

from pathlib import Path

from app.services import dws_scraper

_FIXTURE = Path(__file__).parent / "fixtures" / "dws_weekly_sample.txt"


def _read():
    return dws_scraper._extract_readings_from_text(
        _FIXTURE.read_text(encoding="utf-8"))


def test_takes_last_decimal_as_today_pct():
    _as_of, readings = _read()
    by_id = dict(readings)
    # Today %Full is the last decimal on each row — not the FSC capacity.
    assert by_id["vaal"] == 50.3
    assert by_id["sterkfontein"] == 90.8
    assert by_id["bloemhof"] == 72.6
    assert by_id["theewaterskloof"] == 73.8   # name wraps to next line; code is stable
    assert by_id["voelvlei"] == 59.5          # '#' latest-data marker stripped
    assert by_id["steenbras_upper"] == 81.5
    assert by_id["midmar"] == 62.3
    assert by_id["bridle_drift"] == 60.7


def test_cover_iso_date_is_as_of():
    as_of, _ = _read()
    assert (as_of.year, as_of.month, as_of.day) == (2025, 10, 13)


def test_unknown_station_codes_ignored():
    _as_of, readings = dws_scraper._extract_readings_from_text(
        "Z9R999 SomeUnknownDam River 1 XX 100.000 50.0 51.0 52.0")
    assert readings == []
