"""
DWS Weekly State of Dams scraper.

Downloads the current provincial State of Dams tables and extracts storage
percentage per dam. Writes one DamStorageReading per matched dam.

Idempotent: the (dam_id, as_of, source) unique constraint prevents
duplicate inserts on re-run for the same week.

CLI:
    python -m app.services.dws_scraper

Render cron schedule (weekly, Monday morning UTC):
    "0 6 * * 1"

PDF format
----------
DWS Weekly is a multi-column reservoir report. Each row in the body
pages looks like:

    [zone] <STATION_CODE> <NAME...> <RIVER> <WMA> <PROV> ... <FSC> <WATER> <LAST_YR> <LAST_WK> <TODAY>

Reservoir names get truncated/wrapped by pdfplumber's line extraction
("Theewater" / next line "skloof"; "Steenbra" / next line "s Lower").
Names are unstable, but **station codes** ("C1R001", "G4R007") are
not — they identify the reservoir uniquely. We match on those.

The numeric "Today %Full" is always the LAST decimal on the row
(values like 2560.97, 2625.68, 38.1, 103.4, **102.5** — the last is
today's storage %).

The "as of" date is the first ISO YYYY-MM-DD on the cover ("Weekly
State of the Reservoirs on\\n2025-10-13"). Fallback: previous Monday.
"""

from __future__ import annotations

import io
import json
import logging
import re
from datetime import datetime, timedelta, timezone

import httpx
import pdfplumber
from bs4 import BeautifulSoup
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db.database import SessionLocal
from app.models.models import Dam, DamStorageReading, DataSource
from app.services.notifications import notify_ops


logger = logging.getLogger(__name__)

DWS_WEEKLY_URL = "https://www.dws.gov.za/Hydrology/Weekly/Storage.aspx"
DWS_LEGACY_PDF_URL = "https://www.dws.gov.za/Hydrology/Weekly/Weekly.pdf"
DWS_PROVINCE_URLS: dict[str, str] = {
    "EC": "https://www.dws.gov.za/Hydrology/Weekly/ProvinceWeek.aspx?region=EC",
    "FS": "https://www.dws.gov.za/Hydrology/Weekly/ProvinceWeek.aspx?region=FS",
    "KN": "https://www.dws.gov.za/Hydrology/Weekly/ProvinceWeek.aspx?region=KN",
    "WC": "https://www.dws.gov.za/Hydrology/Weekly/ProvinceWeek.aspx?region=WC",
}
DWS_NIWIS_API_URL = (
    "https://www.dws.gov.za/niwis2/api/Request/"
    "SurfaceWaterStorageDamTableDataChange"
)
SOURCE_NAME = "DWS Weekly State of Dams"
SOURCE_KEY = "dws_weekly_dams"

# DWS reservoir station codes → our dams.id. Codes are stable across
# weekly reports; reservoir names are not (they wrap, get truncated by
# pdfplumber, change capitalisation). Station codes verified against
# the 2025-10-13 PDF; if a future code changes, add the new code here
# rather than relying on name matching.
#
# The `mockes` dam is intentionally absent — Mockes Dam is a Bloemwater
# asset that doesn't appear in DWS Weekly. The dams row stays for
# completeness but no readings come from this scraper.
DWS_STATION_TO_DAM_ID: dict[str, str] = {
    "C1R001": "vaal",
    "C8R003": "sterkfontein",
    "C9R002": "bloemhof",
    "D2R004": "welbedacht",
    "G1R001": "voelvlei",
    "G1R002": "wemmershoek",
    "G1R004": "berg_river",
    "G4R001": "steenbras_lower",
    "G4R007": "steenbras_upper",
    "H6R001": "theewaterskloof",
    "K9R001": "churchill",     # listed as "Kromrivier" in DWS Weekly
    "K9R002": "impofu",
    "L8R001": "kouga",
    "M1R001": "groendal",
    "R2R001": "laing",
    "R2R003": "bridle_drift",
    "S6R002": "wriggleswade",
    "U2R001": "midmar",
    "U2R002": "nagle",
    "U2R003": "albert_falls",
    "U2R004": "inanda",
    "U3R001": "hazelmere",
}

# Names in the current provincial HTML tables. These pages are the maintained
# DWS source and, unlike Weekly.pdf, are accessible from GitHub Actions.
DWS_NAME_TO_DAM_ID: dict[str, str] = {
    "vaal": "vaal",
    "sterkfontein": "sterkfontein",
    "bloemhof": "bloemhof",
    "welbedacht": "welbedacht",
    "voelvlei": "voelvlei",
    "wemmershoek": "wemmershoek",
    "berg river": "berg_river",
    "steenbras lower": "steenbras_lower",
    "steenbras upper": "steenbras_upper",
    "theewaterskloof": "theewaterskloof",
    "kromrivier": "churchill",
    "impofu": "impofu",
    "kouga": "kouga",
    "groendal": "groendal",
    "laing": "laing",
    "bridle drift": "bridle_drift",
    "wriggleswade": "wriggleswade",
    "midmar": "midmar",
    "nagle": "nagle",
    "albert falls": "albert_falls",
    "inanda": "inanda",
    "hazelmere": "hazelmere",
}
EXPECTED_DWS_DAM_IDS = set(DWS_NAME_TO_DAM_ID.values())

# Station code regex matches a body row's station identifier:
#   one upper-case letter, optional 1-2 digits, "R", three digits.
# The `\b` boundaries avoid matching codes inside words.
_STATION_RE = re.compile(r"\b([A-Z]\d{0,2}R\d{3})\b")
# Decimal value (e.g. 102.5, 2560.97). Pure integers like the WMA
# number (which appears mid-row) are intentionally not matched —
# the storage %s and capacities all carry a decimal.
_DECIMAL_RE = re.compile(r"\d+\.\d+")
# ISO date on the cover page: "Weekly State of the Reservoirs on\n2025-10-13"
_ISO_DATE_RE = re.compile(r"\b(\d{4}-\d{2}-\d{2})\b")


def _normalise_dam_name(value: str) -> str:
    value = value.replace("–", "-").replace("—", "-")
    value = re.sub(r"\s+dam\s*$", "", value, flags=re.IGNORECASE)
    value = value.replace("-", " ").lower()
    return re.sub(r"\s+", " ", value).strip()


def _parse_as_of(text: str) -> datetime:
    """First ISO date in the document is the cover 'as of' date."""
    m = _ISO_DATE_RE.search(text)
    if m:
        try:
            return datetime.strptime(m.group(1), "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0,
                                                microsecond=0)
    monday = today - timedelta(days=today.weekday())
    logger.warning("dws_scraper: could not parse 'as of' date — using %s",
                   monday.isoformat())
    return monday


def _fetch_pdf(client: httpx.Client | None = None) -> bytes:
    own = client is None
    c = client or httpx.Client(timeout=60.0, follow_redirects=True)
    try:
        resp = c.get(DWS_LEGACY_PDF_URL)
        resp.raise_for_status()
        return resp.content
    finally:
        if own:
            c.close()


def _extract_readings_from_html(html: str) -> tuple[datetime, list[tuple[str, float]]]:
    """Parse one current DWS provincial State of Dams page.

    The maintained page has columns for Dam, FSC, This Week, Last Week and
    Last Year. Header positions are discovered instead of assumed so that
    harmless presentation changes do not shift the percentage column.
    """
    soup = BeautifulSoup(html, "html.parser")
    page_text = soup.get_text(" ", strip=True)
    as_of = _parse_as_of(page_text)
    readings: dict[str, float] = {}

    for table in soup.find_all("table"):
        this_week_index: int | None = None
        for row in table.find_all("tr"):
            cells = [
                cell.get_text(" ", strip=True)
                for cell in row.find_all(["td", "th"], recursive=False)
            ]
            if not cells:
                continue
            normalised_cells = [re.sub(r"\s+", " ", cell).strip().lower()
                                for cell in cells]
            if "this week" in normalised_cells:
                this_week_index = normalised_cells.index("this week")
                continue
            if this_week_index is None or len(cells) <= this_week_index:
                continue
            dam_id = DWS_NAME_TO_DAM_ID.get(_normalise_dam_name(cells[0]))
            if dam_id is None or dam_id in readings:
                continue
            match = re.search(r"\d{1,3}(?:[.,]\d+)?", cells[this_week_index])
            if match is None:
                continue
            try:
                pct = float(match.group(0).replace(",", "."))
            except ValueError:
                continue
            if 0.0 <= pct <= 200.0:
                readings[dam_id] = pct

    return as_of, list(readings.items())


def _fetch_current_readings(
    client: httpx.Client | None = None,
) -> tuple[datetime, list[tuple[str, float]]]:
    """Fetch all four relevant provincial pages and combine their readings."""
    own = client is None
    c = client or httpx.Client(timeout=60.0, follow_redirects=True)
    combined: dict[str, float] = {}
    page_dates: set[datetime] = set()
    try:
        for province, url in DWS_PROVINCE_URLS.items():
            response = c.get(url, headers={"User-Agent": "Ulwandle/1.0 (+ingest)"})
            response.raise_for_status()
            as_of, readings = _extract_readings_from_html(response.text)
            if not readings:
                raise ValueError(f"DWS {province} page contained no recognised dams")
            page_dates.add(as_of)
            combined.update(readings)
    finally:
        if own:
            c.close()

    if len(page_dates) != 1:
        dates = ", ".join(sorted(value.date().isoformat() for value in page_dates))
        raise ValueError(f"DWS province pages disagree on reporting date: {dates}")
    missing = EXPECTED_DWS_DAM_IDS.difference(combined)
    if missing:
        raise ValueError("DWS pages omitted expected dams: " + ", ".join(sorted(missing)))
    return next(iter(page_dates)), list(combined.items())


def _extract_readings_from_niwis_json(
    payload: str,
) -> tuple[datetime, list[tuple[str, float]]]:
    """Parse the official NIWIS national dam table response by station code."""
    try:
        rows = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise ValueError("DWS NIWIS returned invalid JSON") from exc
    if not isinstance(rows, list):
        raise ValueError("DWS NIWIS response was not a row list")

    readings: dict[str, float] = {}
    dates: set[datetime] = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        dam_id = DWS_STATION_TO_DAM_ID.get(str(row.get("station", "")))
        if dam_id is None or dam_id in readings:
            continue
        try:
            pct = float(row["dam_pc_fsc"])
            as_of = datetime.fromisoformat(str(row["valuedate"]))
        except (KeyError, TypeError, ValueError):
            continue
        if as_of.tzinfo is None:
            as_of = as_of.replace(tzinfo=timezone.utc)
        if 0.0 <= pct <= 200.0:
            readings[dam_id] = pct
            dates.add(as_of)

    missing = set(DWS_STATION_TO_DAM_ID.values()).difference(readings)
    if missing:
        raise ValueError("DWS NIWIS omitted expected dams: " + ", ".join(sorted(missing)))
    if not dates:
        raise ValueError("DWS NIWIS contained no dated readings")
    if len(dates) > 1:
        logger.warning(
            "dws_scraper: NIWIS target dams have mixed dates: %s",
            ", ".join(sorted(value.date().isoformat() for value in dates)),
        )
    return max(dates), list(readings.items())


def _fetch_niwis_readings(
    client: httpx.Client | None = None,
) -> tuple[datetime, list[tuple[str, float]]]:
    """Fetch the official NIWIS national table used when weekly pages block cloud IPs."""
    own = client is None
    c = client or httpx.Client(timeout=120.0, follow_redirects=True)
    today = datetime.now(timezone.utc)
    previous_month = today.replace(day=1) - timedelta(days=1)
    start = previous_month.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if today.month == 12:
        end = today.replace(year=today.year + 1, month=1, day=1)
    else:
        end = today.replace(month=today.month + 1, day=1)
    try:
        response = c.get(
            DWS_NIWIS_API_URL,
            params={
                "areaKey": "/national/Provinces",
                "startDate": start.isoformat(),
                "endDate": end.isoformat(),
            },
            headers={"User-Agent": "Ulwandle/1.0 (+ingest)", "Accept": "application/json"},
        )
        response.raise_for_status()
        return _extract_readings_from_niwis_json(response.text)
    finally:
        if own:
            c.close()


def _fetch_official_readings() -> tuple[datetime, list[tuple[str, float]]]:
    """Prefer current weekly pages, then fall back to DWS's official NIWIS API."""
    try:
        return _fetch_current_readings()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code != 403:
            raise
        logger.warning(
            "dws_scraper: weekly pages returned 403; using official NIWIS API"
        )
        return _fetch_niwis_readings()


def _extract_readings_from_text(text: str) -> tuple[datetime, list[tuple[str, float]]]:
    """Parse already-extracted PDF text. Split out from ``_extract_readings``
    so the fragile, format-dependent parsing (station codes, last-decimal,
    ISO date) is unit-testable against a representative text fixture without
    needing a binary PDF.

    Strategy:
    1. Walk every line.
    2. If a line contains a station code we care about, it's a body row.
    3. Strip the "#" "Latest available data" markers and take the LAST
       decimal value on the row — that's "Today %Full". Validate 0-200.
    4. First occurrence per dam wins (the PDF repeats subtotals later)."""
    readings: dict[str, float] = {}
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        m = _STATION_RE.search(line)
        if m is None:
            continue
        dam_id = DWS_STATION_TO_DAM_ID.get(m.group(1))
        if dam_id is None:
            continue
        clean = line.replace("#", "").replace("&", "")
        decimals = _DECIMAL_RE.findall(clean)
        if not decimals:
            continue
        try:
            pct = float(decimals[-1])
        except ValueError:
            continue
        if not (0.0 <= pct <= 200.0):
            continue
        readings.setdefault(dam_id, pct)

    as_of = _parse_as_of(text)
    return as_of, list(readings.items())


def _extract_readings(pdf_bytes: bytes) -> tuple[datetime, list[tuple[str, float]]]:
    """Extract text from every page, then parse it (see
    ``_extract_readings_from_text``)."""
    full_text_chunks: list[str] = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            full_text_chunks.append(page.extract_text() or "")
    return _extract_readings_from_text("\n".join(full_text_chunks))


def _upsert_reading(session, dam_id: str, pct: float, as_of: datetime) -> None:
    stmt = pg_insert(DamStorageReading).values(
        dam_id=dam_id,
        storage_pct=pct,
        as_of=as_of,
        source=SOURCE_NAME,
        source_url=DWS_WEEKLY_URL,
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_dam_reading_dam_asof_src",
        set_={"storage_pct": stmt.excluded.storage_pct,
              "fetched_at": datetime.now(timezone.utc)},
    )
    session.execute(stmt)


def _record_run(session, status: str, rows: int, error: str | None = None) -> None:
    now = datetime.now(timezone.utc)
    stmt = pg_insert(DataSource).values(
        key=SOURCE_KEY,
        name=SOURCE_NAME,
        url=DWS_WEEKLY_URL,
        last_attempted_at=now,
        last_success_at=now if status == "ok" else None,
        last_status=status,
        last_error=error,
        rows_last_run=rows,
    )
    set_ = {
        "last_attempted_at": stmt.excluded.last_attempted_at,
        "last_status": stmt.excluded.last_status,
        "last_error": stmt.excluded.last_error,
        "rows_last_run": stmt.excluded.rows_last_run,
    }
    if status == "ok":
        set_["last_success_at"] = stmt.excluded.last_success_at
    stmt = stmt.on_conflict_do_update(index_elements=["key"], set_=set_)
    session.execute(stmt)


def run_once() -> int:
    """Fetch + parse + upsert. Returns number of readings written."""
    db = SessionLocal()
    try:
        try:
            as_of, readings = _fetch_official_readings()
        except Exception as exc:
            _record_run(db, status="error", rows=0, error=str(exc)[:1000])
            db.commit()
            logger.exception("dws_scraper: fetch/parse failed")
            notify_ops(f"DWS weekly dam scraper FAILED to fetch/parse: "
                       f"{str(exc)[:200]}", level="error")
            return 0

        known_ids = {row[0] for row in db.query(Dam.id).all()}
        written = 0
        for dam_id, pct in readings:
            if dam_id not in known_ids:
                continue
            _upsert_reading(db, dam_id, pct, as_of)
            written += 1

        status = "ok" if written > 0 else "partial"
        _record_run(db, status=status, rows=written,
                    error=None if written else "No readings matched known dams")
        db.commit()
        logger.info("dws_scraper: wrote %d readings as_of=%s", written, as_of.isoformat())
        if status != "ok":
            notify_ops("DWS weekly dam scraper matched 0 known dams. The "
                       "State of Dams page layout or dam names likely changed. Dam "
                       "levels will go stale until fixed.", level="error")
        return written
    finally:
        db.close()


def main() -> int:
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    written = run_once()
    return 0 if written > 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
