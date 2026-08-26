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


def test_current_html_table_extracts_this_week_column():
    html = """
    <html><body>
      <h2>State of Dams on 2026-08-24</h2>
      <table>
        <tr><th>Dam</th><th>River</th><th>Photo</th><th>Indicators</th>
            <th>FSC</th><th>This Week</th><th>Last Week</th><th>Last Year</th></tr>
        <tr><td>Berg River Dam</td><td>Berg</td><td></td><td></td>
            <td>127.1</td><td>91.0</td><td>90.2</td><td>77.1</td></tr>
        <tr><td>Steenbras-Lower Dam</td><td>Steenbras</td><td></td><td></td>
            <td>33.5</td><td>49.6</td><td>48.1</td><td>72.0</td></tr>
        <tr><td>Kromrivier Dam</td><td>Krom</td><td></td><td></td>
            <td>35.9</td><td>100.5</td><td>99.1</td><td>80.0</td></tr>
      </table>
    </body></html>
    """
    as_of, readings = dws_scraper._extract_readings_from_html(html)
    assert (as_of.year, as_of.month, as_of.day) == (2026, 8, 24)
    assert dict(readings) == {
        "berg_river": 91.0,
        "steenbras_lower": 49.6,
        "churchill": 100.5,
    }


def test_niwis_json_maps_stations_and_uses_latest_date():
    rows = []
    for station, dam_id in dws_scraper.DWS_STATION_TO_DAM_ID.items():
        rows.append({
            "station": station,
            "reservoir": dam_id,
            "valuedate": "2026-08-10T00:00:00",
            "dam_pc_fsc": 88.5,
        })
    as_of, readings = dws_scraper._extract_readings_from_niwis_json(
        __import__("json").dumps(rows)
    )
    assert (as_of.year, as_of.month, as_of.day) == (2026, 8, 10)
    assert len(readings) == 22
    assert dict(readings)["vaal"] == 88.5


def test_niwis_json_rejects_missing_expected_dam():
    import pytest

    with pytest.raises(ValueError, match="omitted expected dams"):
        dws_scraper._extract_readings_from_niwis_json(
            '[{"station":"C1R001","valuedate":"2026-08-10T00:00:00",'
            '"dam_pc_fsc":101.0}]'
        )
