"""
DWS Weekly State of Dams scraper.

Downloads the canonical Weekly.pdf and extracts storage % per dam, matching
against the dams in our `dams` table by name. Writes one
DamStorageReading per matched dam.

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
import logging
import re
from datetime import datetime, timedelta, timezone

import httpx
import pdfplumber
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db.database import SessionLocal
from app.models.models import Dam, DamStorageReading, DataSource


logger = logging.getLogger(__name__)

DWS_WEEKLY_URL = "https://www.dws.gov.za/Hydrology/Weekly/Weekly.pdf"
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
        resp = c.get(DWS_WEEKLY_URL)
        resp.raise_for_status()
        return resp.content
    finally:
        if own:
            c.close()


def _extract_readings(pdf_bytes: bytes) -> tuple[datetime, list[tuple[str, float]]]:
    """Parse the PDF and return (as_of, [(dam_id, pct), ...]).

    Strategy:
    1. Walk every line on every page.
    2. If a line contains a station code we care about, it's a body row.
    3. Strip the "#" "Latest available data" markers and take the LAST
       decimal value on the row — that's "Today %Full". Validate 0-200.
    4. First occurrence per dam wins (the PDF repeats subtotals later)."""
    readings: dict[str, float] = {}
    full_text_chunks: list[str] = []

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            full_text_chunks.append(text)
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

    as_of = _parse_as_of("\n".join(full_text_chunks))
    return as_of, list(readings.items())


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
            pdf_bytes = _fetch_pdf()
            as_of, readings = _extract_readings(pdf_bytes)
        except Exception as exc:
            _record_run(db, status="error", rows=0, error=str(exc)[:1000])
            db.commit()
            logger.exception("dws_scraper: fetch/parse failed")
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
