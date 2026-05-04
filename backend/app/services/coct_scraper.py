"""
City of Cape Town daily dam levels scraper.

Pulls the public dashboard at:
    https://www.capetown.gov.za/.../this-weeks-dam-levels

Format observed (verified 2026-05-04):

    | Dam              | Storage (Ml) | Percentage |
    | Berg River       | 130,010      | 48.7%      |
    | Steenbras Lower  |  33,517      | 40.0%      |
    | Steenbras Upper  |  31,767      | 55.4%      |
    | Theewaterskloof  | 480,188      | 47.7%      |
    | Voëlvlei         | 164,095      | 49.9%      |
    | Wemmershoek      |  58,644      | 49.1%      |
    | Total Stored     | 433,989 Ml   | 48.3%      |

The scraper extracts each dam row, writes one DamStorageReading per dam
keyed to the day shown on the page, and is idempotent on
(dam_id, as_of, source).

Render cron schedule (daily, 06:00 UTC):
    "0 6 * * *"
"""

from __future__ import annotations

import logging
import re
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Iterable

from bs4 import BeautifulSoup
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db.database import SessionLocal
from app.models.models import DamStorageReading, DataSource, Metro, MetroConsumptionReading


logger = logging.getLogger(__name__)

COCT_DASHBOARD_URL = (
    "https://www.capetown.gov.za/Family%20and%20home/"
    "Residential-utility-services/Residential-water-and-sanitation-services/"
    "this-weeks-dam-levels"
)
SOURCE_NAME = "City of Cape Town — Daily Dam Levels"
SOURCE_KEY = "coct_daily_dams"

# Display-name → dam.id. Match is case-insensitive after normalising
# accented chars and stripping trailing "Dam".
DAM_NAME_TO_ID: dict[str, str] = {
    "berg river": "berg_river",
    "steenbras lower": "steenbras_lower",
    "steenbras upper": "steenbras_upper",
    "theewaterskloof": "theewaterskloof",
    "voelvlei": "voelvlei",
    "wemmershoek": "wemmershoek",
}

_NORM_DIACRITICS = str.maketrans("ëéèêÈÉÊË", "eeeeEEEE")
# Matches a numeric run with optional thousands separators and decimals.
_NUM_RE = re.compile(r"\d{1,3}(?:[, ]\d{3})*(?:\.\d+)?")
# Matches a percentage: "48.3%" or "48,3 %".
_PCT_RE = re.compile(r"\b(\d{1,3}(?:[.,]\d{1,2})?)\s*%")
# Matches a date like "4/5/2026" or "04 May 2026".
_DATE_NUMERIC_RE = re.compile(r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b")
_DATE_LONG_RE = re.compile(
    r"\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|"
    r"September|October|November|December)\s+(\d{4})\b",
    re.IGNORECASE,
)
_MONTHS = {m.lower(): i for i, m in enumerate(
    ["", "January", "February", "March", "April", "May", "June",
     "July", "August", "September", "October", "November", "December"], )}


def _normalise(s: str) -> str:
    return s.translate(_NORM_DIACRITICS).lower().strip()


def _match_dam(cell_text: str) -> str | None:
    norm = _normalise(cell_text)
    norm = re.sub(r"\s+dam\s*$", "", norm).strip()
    return DAM_NAME_TO_ID.get(norm)


def _to_float(s: str) -> float | None:
    """Parse '433,989' or '48.3' or '48,3' to float."""
    s = s.strip().replace(" ", "")
    if not s:
        return None
    # Heuristic: if there's both '.' and ',' assume comma is a thousands sep.
    if "." in s and "," in s:
        s = s.replace(",", "")
    elif "," in s and "." not in s:
        # Could be either thousands or decimal. South African pages use
        # both. Treat ",NNN" as thousands; "N,N" (single digit after) as
        # decimal.
        if re.match(r"^\d{1,3}(,\d{3})+$", s):
            s = s.replace(",", "")
        else:
            s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def _parse_as_of(text: str) -> datetime:
    m = _DATE_NUMERIC_RE.search(text)
    if m:
        try:
            day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
            return datetime(year, month, day, tzinfo=timezone.utc)
        except ValueError:
            pass
    m = _DATE_LONG_RE.search(text)
    if m:
        try:
            day = int(m.group(1))
            month = _MONTHS[m.group(2).lower()]
            year = int(m.group(3))
            return datetime(year, month, day, tzinfo=timezone.utc)
        except (KeyError, ValueError):
            pass
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0,
                                                microsecond=0)
    logger.warning("coct_scraper: could not parse 'as of' date — using %s",
                   today.isoformat())
    return today


def _fetch_html() -> str:
    """Fetch the City of Cape Town dam-levels dashboard.

    Uses the stdlib urllib instead of httpx because the CoCT origin
    emits duplicate Transfer-Encoding headers, which httpx (via h11)
    refuses by RFC 7230. urllib's parser is permissive about this and
    returns the body cleanly. urllib also follows redirects by default
    and sets a sane connection timeout via the urlopen ``timeout`` kw.
    """
    req = urllib.request.Request(
        COCT_DASHBOARD_URL,
        headers={"User-Agent": "Ulwandle/1.0 (+ingest)"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        charset = resp.headers.get_content_charset() or "utf-8"
        return resp.read().decode(charset, errors="replace")


def _extract_readings(html: str) -> tuple[datetime, list[tuple[str, float, float | None]]]:
    """Return (as_of, [(dam_id, pct, storage_ml or None), ...])."""
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(" ", strip=True)
    as_of = _parse_as_of(text)

    readings: list[tuple[str, float, float | None]] = []
    seen: set[str] = set()

    for table in soup.find_all("table"):
        for row in table.find_all("tr"):
            cells = [c.get_text(" ", strip=True) for c in row.find_all(["td", "th"])]
            if len(cells) < 2:
                continue
            dam_id = _match_dam(cells[0])
            if not dam_id or dam_id in seen:
                continue
            row_text = " ".join(cells[1:])
            pct_match = _PCT_RE.search(row_text)
            if not pct_match:
                continue
            pct = _to_float(pct_match.group(1))
            if pct is None or not (0.0 <= pct <= 200.0):
                continue
            # Storage Ml is the first numeric run before the percent sign.
            ml: float | None = None
            for n in _NUM_RE.finditer(row_text):
                if n.end() <= pct_match.start():
                    val = _to_float(n.group())
                    # Filter obviously bogus matches (year-like 2026).
                    if val is not None and val < 5_000_000:
                        ml = val
            readings.append((dam_id, pct, ml))
            seen.add(dam_id)

    return as_of, readings


def _upsert_dam_reading(session, dam_id: str, pct: float,
                        ml: float | None, as_of: datetime) -> None:
    stmt = pg_insert(DamStorageReading).values(
        dam_id=dam_id,
        storage_pct=pct,
        storage_ml=ml,
        as_of=as_of,
        source=SOURCE_NAME,
        source_url=COCT_DASHBOARD_URL,
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_dam_reading_dam_asof_src",
        set_={
            "storage_pct": stmt.excluded.storage_pct,
            "storage_ml": stmt.excluded.storage_ml,
            "fetched_at": datetime.now(timezone.utc),
        },
    )
    session.execute(stmt)


def _record_run(session, status: str, rows: int, error: str | None = None) -> None:
    now = datetime.now(timezone.utc)
    stmt = pg_insert(DataSource).values(
        key=SOURCE_KEY,
        name=SOURCE_NAME,
        url=COCT_DASHBOARD_URL,
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
    """Fetch + parse + upsert. Returns number of dam readings written."""
    db = SessionLocal()
    try:
        try:
            html = _fetch_html()
            as_of, readings = _extract_readings(html)
        except Exception as exc:
            _record_run(db, status="error", rows=0, error=str(exc)[:1000])
            db.commit()
            logger.exception("coct_scraper: fetch/parse failed")
            return 0

        known = {row[0] for row in db.query(DamStorageReading.dam_id).distinct().all()}  # noqa: F841 (unused but kept for future cross-check)
        written = 0
        for dam_id, pct, ml in readings:
            _upsert_dam_reading(db, dam_id, pct, ml, as_of)
            written += 1

        status = "ok" if written > 0 else "partial"
        _record_run(db, status=status, rows=written,
                    error=None if written else "No dam rows matched on the page")
        db.commit()
        logger.info("coct_scraper: wrote %d dam readings as_of=%s",
                    written, as_of.isoformat())
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
