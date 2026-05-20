"""
CoCT daily dam-levels scraper — parser tests.

The CoCT page wraps its table in HTML-escaped text inside a CMS field, so
the unescape step is critical. These tests assert:
- the diacritic-folded, ZWSP-stripped name matcher resolves every published
  Cape Town dam to our internal id
- the 3-column "name | Ml | %" table is parsed by column position
- the "as of" date is picked up from typical CoCT phrasing
- the South African number formats (comma decimal, NBSP thousands) all
  resolve to a single float
"""

from __future__ import annotations

import html as html_lib

import pytest

from app.services.coct_scraper import (
    _extract_readings, _match_dam, _normalise, _parse_as_of, _to_float,
)


FIXTURE_TABLE = """
<div>
  <h2>This week's dam levels — 4 May 2026</h2>
  <table>
    <tr><th>Dam</th><th>Storage (Ml)</th><th>Percentage</th></tr>
    <tr><td>Berg River</td><td>130,010</td><td>48.7</td></tr>
    <tr><td>Steenbras L​ower</td><td>33,517</td><td>40.0</td></tr>
    <tr><td>Steenbras Upper</td><td>31,767</td><td>55.4</td></tr>
    <tr><td>Theewaterskloof Dam</td><td>480,188</td><td>47.7</td></tr>
    <tr><td>Vo&euml;lvlei</td><td>164,095</td><td>49.9</td></tr>
    <tr><td>Wemmershoek</td><td>58,644</td><td>49.1</td></tr>
    <tr><td>Total Stored</td><td>433,989</td><td>48.3</td></tr>
  </table>
</div>
"""

# CoCT serves the table HTML-encoded inside a CMS field. The scraper has
# to unescape once before BS4 sees real tags.
ENCODED_FIXTURE = html_lib.escape(FIXTURE_TABLE)


def test_normalise_strips_zero_width_chars_and_folds_diacritics():
    assert _normalise("Steenbras L​ower") == "steenbras lower"
    assert _normalise("VoëLVLEI") == "voelvlei"
    assert _normalise("  Berg River  ") == "berg river"


@pytest.mark.parametrize(
    "label,expected",
    [
        ("Berg River", "berg_river"),
        ("Berg River Dam", "berg_river"),
        ("Steenbras Lower", "steenbras_lower"),
        ("Steenbras L​ower", "steenbras_lower"),
        ("Theewaterskloof", "theewaterskloof"),
        ("Theewaterskloof Dam", "theewaterskloof"),
        ("Voëlvlei", "voelvlei"),
        ("Wemmershoek", "wemmershoek"),
    ],
)
def test_match_dam_handles_official_labels(label, expected):
    assert _match_dam(label) == expected


def test_match_dam_rejects_unknown_labels():
    assert _match_dam("Total Stored") is None
    assert _match_dam("") is None
    assert _match_dam("Random Lake") is None


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("130,010", 130010.0),
        ("130 010", 130010.0),  # NBSP-as-thousands also matches \s+
        ("48.3", 48.3),
        ("48,3", 48.3),
        ("1,234.56", 1234.56),
        ("", None),
        ("not-a-number", None),
    ],
)
def test_to_float_handles_sa_number_formats(raw, expected):
    assert _to_float(raw) == expected


def test_parse_as_of_picks_up_long_date():
    dt = _parse_as_of("Dam levels for the week of 4 May 2026 were ...")
    assert dt.year == 2026 and dt.month == 5 and dt.day == 4


def test_parse_as_of_picks_up_numeric_date():
    dt = _parse_as_of("As at 12/3/2026 the dams ...")
    assert dt.year == 2026 and dt.month == 3 and dt.day == 12


def test_extract_readings_returns_every_known_dam_with_valid_pct():
    """Driving the full parser end-to-end against the encoded CMS fixture
    is the regression test we want: a CoCT layout change shows up here as
    a missing dam, not as a silent zero-row scrape in production."""
    as_of, readings = _extract_readings(ENCODED_FIXTURE)
    by_id = {dam_id: (pct, ml) for dam_id, pct, ml in readings}

    assert as_of.year == 2026 and as_of.month == 5 and as_of.day == 4
    assert set(by_id) == {
        "berg_river", "steenbras_lower", "steenbras_upper",
        "theewaterskloof", "voelvlei", "wemmershoek",
    }
    assert by_id["berg_river"][0] == pytest.approx(48.7)
    assert by_id["theewaterskloof"][1] == pytest.approx(480188.0)
    # Comma-thousands variants resolved correctly.
    assert by_id["wemmershoek"][1] == pytest.approx(58644.0)


def test_extract_readings_drops_rows_with_bogus_pct():
    """A future page redesign could put a year in the % column. The
    0-200 sanity filter must drop those rather than write a junk reading."""
    bad = html_lib.escape("""
    <table>
      <tr><td>Berg River</td><td>130,010</td><td>2026</td></tr>
    </table>
    """)
    _, readings = _extract_readings(bad)
    assert readings == []
