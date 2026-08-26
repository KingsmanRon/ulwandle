"""
Regression tests for the City of Cape Town daily dam-levels parser.

The fixture reproduces the quirks the live page actually throws at us:
HTML-escaped table markup inside a content field, a zero-width space inside a
dam name, a diacritic (Voëlvlei), thousands separators, and header/total rows
that must be ignored. If capetown.gov.za changes layout and these break, CI
fails here instead of the dashboard silently going stale.
"""

from pathlib import Path

from app.services import coct_scraper

_FIXTURE = Path(__file__).parent / "fixtures" / "coct_sample.html"
_EXPECTED_DAMS = {
    "berg_river", "steenbras_lower", "steenbras_upper",
    "theewaterskloof", "voelvlei", "wemmershoek",
}


def _read():
    return coct_scraper._extract_readings(_FIXTURE.read_text(encoding="utf-8"))


def test_extracts_all_six_dams_with_correct_pcts():
    as_of, readings = _read()
    by_id = {dam_id: (pct, ml) for dam_id, pct, ml in readings}
    assert set(by_id) == _EXPECTED_DAMS
    assert by_id["berg_river"][0] == 76.2
    assert by_id["steenbras_lower"][0] == 51.9   # zero-width char in name survived
    assert by_id["steenbras_upper"][0] == 81.5
    assert by_id["theewaterskloof"][0] == 73.8
    assert by_id["voelvlei"][0] == 59.5          # diacritic normalised
    assert by_id["wemmershoek"][0] == 96.9


def test_thousands_separator_parsed_to_ml():
    _, readings = _read()
    by_id = {dam_id: ml for dam_id, _pct, ml in readings}
    assert by_id["berg_river"] == 130010.0
    assert by_id["theewaterskloof"] == 480188.0


def test_header_and_total_rows_ignored():
    _, readings = _read()
    assert len(readings) == 6
    assert all(dam_id in _EXPECTED_DAMS for dam_id, _p, _m in readings)


def test_as_of_date_parsed_from_long_form():
    as_of, _ = _read()
    assert (as_of.year, as_of.month, as_of.day) == (2026, 6, 3)


def test_current_release_table_layout_is_supported():
    html = """
    <html><body><p>Dam levels as at 25 August 2026</p>
      <table>
        <tr><th>Dam</th><th>Capacity when full</th><th>25 August 2026</th></tr>
        <tr><td>Berg River</td><td>130 010</td><td>91.1</td></tr>
        <tr><td>Voëlvlei</td><td>164 095</td><td>60.6</td></tr>
      </table>
    </body></html>
    """
    as_of, readings = coct_scraper._extract_readings(html)
    assert (as_of.year, as_of.month, as_of.day) == (2026, 8, 25)
    assert readings == [
        ("berg_river", 91.1, 130010.0),
        ("voelvlei", 60.6, 164095.0),
    ]


def test_mislabelled_windows_encoding_preserves_voelvlei():
    body = "Voëlvlei".encode("cp1252")
    assert coct_scraper._decode_html(body, "utf-8") == "Voëlvlei"
