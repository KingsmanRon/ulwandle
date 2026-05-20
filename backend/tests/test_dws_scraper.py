"""
DWS Weekly scraper — regex + station-code mapping tests.

End-to-end PDF parsing requires pdfplumber and a real Weekly.pdf fixture,
which is heavy to commit. These tests cover the parts that have actually
broken in production: the station-code regex, the last-decimal heuristic,
and the cover-page date pickup.
"""

from __future__ import annotations

from app.services.dws_scraper import (
    DWS_STATION_TO_DAM_ID, _DECIMAL_RE, _ISO_DATE_RE, _STATION_RE, _parse_as_of,
)


def test_station_code_regex_matches_real_codes():
    for code in DWS_STATION_TO_DAM_ID:
        assert _STATION_RE.search(code) is not None


def test_station_code_regex_does_not_match_inside_words():
    """`\\b...\\b` boundaries: an ID embedded in a product code must not match."""
    assert _STATION_RE.search("ABCH6R001XYZ") is None
    # But a code at start/end of a line — does match.
    assert _STATION_RE.search("H6R001 Theewaterskloof") is not None


def test_decimal_regex_finds_last_value_on_a_body_row():
    line = "[zone] H6R001 Theewaterskloof Sonderend BREEDE WC 480.188 2560.97 102.5"
    decimals = _DECIMAL_RE.findall(line)
    assert decimals, "must extract at least one decimal"
    # The scraper's contract: last decimal is "Today %Full".
    assert float(decimals[-1]) == 102.5


def test_iso_date_regex_picks_up_cover_date():
    cover = "Weekly State of the Reservoirs on\n2025-10-13"
    m = _ISO_DATE_RE.search(cover)
    assert m is not None
    assert m.group(1) == "2025-10-13"


def test_parse_as_of_falls_back_to_monday_when_no_date():
    dt = _parse_as_of("no iso date anywhere in this text body")
    # Whatever Monday the fallback chooses, it must be UTC midnight on a Monday.
    assert dt.tzinfo is not None
    assert dt.hour == 0 and dt.minute == 0 and dt.second == 0
    assert dt.weekday() == 0  # Monday


def test_station_to_dam_id_covers_all_metro_dams():
    """The scraper relies on station codes being stable across PDFs.
    The map MUST cover every dam our metros depend on."""
    metro_critical = {"vaal", "theewaterskloof", "midmar", "albert_falls", "voelvlei"}
    mapped = set(DWS_STATION_TO_DAM_ID.values())
    missing = metro_critical - mapped
    assert not missing, f"station map missing {missing}"


def test_station_to_dam_id_has_no_duplicate_dams():
    values = list(DWS_STATION_TO_DAM_ID.values())
    assert len(values) == len(set(values)), \
        "two station codes map to the same dam — readings will overwrite each other"
