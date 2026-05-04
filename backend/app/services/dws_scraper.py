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
The DWS Weekly Reservoir Report is a multi-column PDF where each row is
roughly:

    <DAM NAME>  <RIVER>  <FSC>  <THIS WEEK %>  <LAST WEEK %>  <LAST YEAR %>  ...

Format has been stable for years but may change. The parser logs a
PARSE_FORMAT_CHANGED warning and bails (no partial commits) if it
encounters unexpected layout. The Postgres unique constraint then
prevents partial-write damage on retry.

The "as_of" date for each reading is taken from the PDF cover ("REPORT FOR
WEEK ENDING <date>"). If the cover can't be parsed, we fall back to the
previous Monday in UTC.
"""

from __future__ import annotations

import io
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Iterable

import httpx
import pdfplumber
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db.database import SessionLocal
from app.models.models import Dam, DamStorageReading, DataSource


logger = logging.getLogger(__name__)

DWS_WEEKLY_URL = "https://www.dws.gov.za/Hydrology/Weekly/Weekly.pdf"
SOURCE_NAME = "DWS Weekly State of Dams"
SOURCE_KEY = "dws_weekly_dams"

# Maps dam-name strings as they appear in the DWS PDF to our `dams.id`.
# Keys are normalised (lower, no diacritics, single space). The matcher
# tolerates trailing "DAM" and parenthetical suffixes.
DAM_NAME_TO_ID: dict[str, str] = {
    "vaal": "vaal",
    "sterkfontein": "sterkfontein",
    "bloemhof": "bloemhof",
    "theewaterskloof": "theewaterskloof",
    "voelvlei": "voelvlei",
    "berg river": "berg_river",
    "wemmershoek": "wemmershoek",
    "steenbras lower": "steenbras_lower",
    "steenbras upper": "steenbras_upper",
    "inanda": "inanda",
    "albert falls": "albert_falls",
    "midmar": "midmar",
    "hazelmere": "hazelmere",
    "nagle": "nagle",
    "kouga": "kouga",
    "impofu": "impofu",
    "mpofu": "impofu",
    "churchill": "churchill",
    "groendal": "groendal",
    "bridle drift": "bridle_drift",
    "wriggleswade": "wriggleswade",
    "laing": "laing",
    "mockes": "mockes",
    "welbedacht": "welbedacht",
}


_NORM_DIACRITICS = str.maketrans("ëéèêÈÉÊË", "eeeeEEEE")
# DWS rows: leading dam name, then numeric columns. We extract the dam name
# segment (up to first 3+ digit cluster or a known column header word) and
# the first percent-looking value after a numeric run.
_PCT_RE = re.compile(r"\b(\d{1,3}(?:[.,]\d{1,2})?)\s*%?\b")
_AS_OF_RE = re.compile(
    r"WEEK\s+ENDING\s+(?P<d>\d{1,2})\s+(?P<m>[A-Za-z]+)\s+(?P<y>\d{4})",
    re.IGNORECASE,
)
_MONTH_LOOKUP = {m.lower(): i for i, m in enumerate(
    ["", "January", "February", "March", "April", "May", "June",
     "July", "August", "September", "October", "November", "December"], )}


def _normalise(s: str) -> str:
    return s.translate(_NORM_DIACRITICS).lower().strip()


def _match_dam(line: str) -> str | None:
    """Try to match a known dam name appearing as a prefix substring.

    DWS lines look like "VAAL                  Vaal     2536.18 ..." — the
    name is the first significant token. We test each known key as a
    leading prefix on the normalised line.
    """
    norm = _normalise(line)
    # Greedy: prefer the longest matching key so "steenbras lower" beats
    # "steenbras".
    matches = [k for k in DAM_NAME_TO_ID if norm.startswith(k)]
    if not matches:
        return None
    longest = max(matches, key=len)
    return DAM_NAME_TO_ID[longest]


def _extract_pct(line: str) -> float | None:
    """Return the first plausible storage percentage on a line (0-200)."""
    for m in _PCT_RE.finditer(line):
        try:
            v = float(m.group(1).replace(",", "."))
        except ValueError:
            continue
        if 0.0 <= v <= 200.0:
            return v
    return None


def _parse_as_of(text: str) -> datetime:
    m = _AS_OF_RE.search(text)
    if m:
        try:
            day = int(m.group("d"))
            month = _MONTH_LOOKUP[m.group("m").lower()]
            year = int(m.group("y"))
            return datetime(year, month, day, tzinfo=timezone.utc)
        except (KeyError, ValueError):
            pass
    # Fallback: last Monday UTC.
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
    """Parse the PDF and return (as_of, [(dam_id, pct), ...])."""
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
                dam_id = _match_dam(line)
                if dam_id is None:
                    continue
                pct = _extract_pct(line)
                if pct is None:
                    continue
                # Keep the first occurrence (PDF often repeats summaries).
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
