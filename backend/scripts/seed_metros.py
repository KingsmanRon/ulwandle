"""
Seed metros, dams, metro_dams and data_sources with verified public-source
figures.

Idempotent: safe to re-run. Each call upserts by primary key. Time-series
tables (dam_storage_readings, metro_consumption_readings) are populated by
the scrapers, not this script.

Run:
    python -m scripts.seed_metros

Source attribution
==================

Population: Stats SA Census 2022 (release date 2023-10-10), aggregated via
citypopulation.de. Verified against direct Stats SA pages where available.

Non-Revenue Water % per metro:
    Johannesburg     46.2%   Joburg Water Annual Report 2023/24 (April 2025)
    Cape Town        24.0%   Daily Maverick / DWS No Drop 2024
    eThekwini        58.7%   Daily Maverick / IOL coverage 2024-2026
    Nelson Mandela Bay 48.66% The Herald, 2025-01-31
    Tshwane          39.0%   Tshwane non-technical losses (AGSA 2023/24);
                              total NRW likely higher — flagged with caveat
    Ekurhuleni       41.9%   DWS Gauteng provincial (2023) — proxy
    Buffalo City     47.0%   DWS national 2023 baseline — pending direct
    Mangaung         47.0%   DWS national 2023 baseline — pending direct

Per-capita litres/day: 216 L/c/d national (DWS No Drop / Blue Drop watch
report 2023). Used as baseline for all 8 metros until per-metro figures from
each municipal annual report are sourced. Cape Town historically lower
(~150 L/c/d during Day Zero recovery); Joburg historically higher
(~250 L/c/d) but no current per-metro figure is verified here.
"""

from __future__ import annotations

from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db.database import SessionLocal
from app.models.models import (
    Dam, DataSource, Metro, MetroDam,
)


# Per-capita national baseline (DWS 2023). Per-metro figures are noted in
# the caveat field where the metro's own report differs notably.
NATIONAL_LPCD = 216.0
NATIONAL_LPCD_AS_OF = "2023 (DWS national)"
NATIONAL_LPCD_SOURCE = "DWS No Drop / Blue Drop Watch Report 2023"
NATIONAL_LPCD_SOURCE_URL = "https://ws.dws.gov.za/iris/releases/NDWR.pdf"
NATIONAL_LPCD_CAVEAT = "National baseline; per-metro figure pending direct municipal report."


METROS: list[dict] = [
    {
        "id": "johannesburg", "code": "JHB", "name": "City of Johannesburg",
        "province": "Gauteng", "latitude": -26.2041, "longitude": 28.0473,
        "population": 4_803_262,
        "population_as_of": "Census 2022", "population_source": "Stats SA Census 2022",
        "population_source_url": "https://census.statssa.gov.za/",
        "nrw_pct": 46.2,
        "nrw_as_of": "2023/24",
        "nrw_source": "Johannesburg Water Annual Report 2023/24",
        "nrw_source_url": "https://johannesburgwater.co.za/wp-content/uploads/2025/04/160512-JHB-WATER-ANNUAL-REPORT-2024-15-04-2025.pdf",
        "nrw_caveat": None,
        "per_capita_lpcd": NATIONAL_LPCD,
        "per_capita_as_of": NATIONAL_LPCD_AS_OF,
        "per_capita_source": NATIONAL_LPCD_SOURCE,
        "per_capita_source_url": NATIONAL_LPCD_SOURCE_URL,
        "per_capita_caveat": NATIONAL_LPCD_CAVEAT,
    },
    {
        "id": "cape_town", "code": "CPT", "name": "City of Cape Town",
        "province": "Western Cape", "latitude": -33.9249, "longitude": 18.4241,
        "population": 4_772_846,
        "population_as_of": "Census 2022", "population_source": "Stats SA Census 2022",
        "population_source_url": "https://census.statssa.gov.za/",
        "nrw_pct": 24.0,
        "nrw_as_of": "2024",
        "nrw_source": "DWS No Drop 2023 / Daily Maverick coverage",
        "nrw_source_url": "https://ws.dws.gov.za/iris/releases/ND_2023_Report.pdf",
        "nrw_caveat": "Cape Town achieved No Drop certification (>90% score). 20.4% of NRW from leaks.",
        "per_capita_lpcd": NATIONAL_LPCD,
        "per_capita_as_of": NATIONAL_LPCD_AS_OF,
        "per_capita_source": NATIONAL_LPCD_SOURCE,
        "per_capita_source_url": NATIONAL_LPCD_SOURCE_URL,
        "per_capita_caveat": "National baseline. Cape Town's actual figure historically lower post-Day-Zero recovery.",
    },
    {
        "id": "ekurhuleni", "code": "EKU", "name": "City of Ekurhuleni",
        "province": "Gauteng", "latitude": -26.1841, "longitude": 28.1935,
        "population": 4_066_691,
        "population_as_of": "Census 2022", "population_source": "Stats SA Census 2022",
        "population_source_url": "https://census.statssa.gov.za/",
        "nrw_pct": 41.9,
        "nrw_as_of": "2023",
        "nrw_source": "DWS Gauteng provincial NRW 2023",
        "nrw_source_url": "https://ws.dws.gov.za/iris/releases/ND_2023_Report.pdf",
        "nrw_caveat": "Provincial Gauteng proxy — pending Ekurhuleni-specific figure from municipal annual report.",
        "per_capita_lpcd": NATIONAL_LPCD,
        "per_capita_as_of": NATIONAL_LPCD_AS_OF,
        "per_capita_source": NATIONAL_LPCD_SOURCE,
        "per_capita_source_url": NATIONAL_LPCD_SOURCE_URL,
        "per_capita_caveat": NATIONAL_LPCD_CAVEAT,
    },
    {
        "id": "ethekwini", "code": "ETH", "name": "eThekwini",
        "province": "KwaZulu-Natal", "latitude": -29.8587, "longitude": 31.0218,
        "population": 4_239_901,
        "population_as_of": "Census 2022", "population_source": "Stats SA Census 2022",
        "population_source_url": "https://census.statssa.gov.za/",
        "nrw_pct": 58.7,
        "nrw_as_of": "2024",
        "nrw_source": "Daily Maverick / IOL coverage 2024-2026",
        "nrw_source_url": "https://www.dailymaverick.co.za/article/2026-04-29-water-down-the-drain-announcing-the-winners-of-sas-leakiest-cities-awards/",
        "nrw_caveat": "Among the highest NRW in SA metros; classified critical by DWS 2023 No Drop.",
        "per_capita_lpcd": NATIONAL_LPCD,
        "per_capita_as_of": NATIONAL_LPCD_AS_OF,
        "per_capita_source": NATIONAL_LPCD_SOURCE,
        "per_capita_source_url": NATIONAL_LPCD_SOURCE_URL,
        "per_capita_caveat": NATIONAL_LPCD_CAVEAT,
    },
    {
        "id": "tshwane", "code": "TSH", "name": "City of Tshwane",
        "province": "Gauteng", "latitude": -25.7479, "longitude": 28.2293,
        "population": 4_040_315,
        "population_as_of": "Census 2022", "population_source": "Stats SA Census 2022",
        "population_source_url": "https://census.statssa.gov.za/",
        "nrw_pct": 39.0,
        "nrw_as_of": "2023/24",
        "nrw_source": "Tshwane Water Balance Dashboard / AGSA 2023/24 findings",
        "nrw_source_url": "https://www.tshwane.gov.za/?page_id=93961",
        "nrw_caveat": "Non-technical (commercial) losses only. Total NRW including physical losses likely higher.",
        "per_capita_lpcd": NATIONAL_LPCD,
        "per_capita_as_of": NATIONAL_LPCD_AS_OF,
        "per_capita_source": NATIONAL_LPCD_SOURCE,
        "per_capita_source_url": NATIONAL_LPCD_SOURCE_URL,
        "per_capita_caveat": NATIONAL_LPCD_CAVEAT,
    },
    {
        "id": "nelson_mandela_bay", "code": "NMB", "name": "Nelson Mandela Bay",
        "province": "Eastern Cape", "latitude": -33.9615, "longitude": 25.6022,
        "population": 1_190_496,
        "population_as_of": "Census 2022", "population_source": "Stats SA Census 2022",
        "population_source_url": "https://census.statssa.gov.za/",
        "nrw_pct": 48.66,
        "nrw_as_of": "2023/24",
        "nrw_source": "The Herald, 2025-01-31",
        "nrw_source_url": "https://www.theherald.co.za/news/politics/2025-01-31-almost-half-of-nelson-mandela-bays-water-down-the-drain/",
        "nrw_caveat": "Some sources cite >53% total NRW (with ~35% attributed to physical losses).",
        "per_capita_lpcd": NATIONAL_LPCD,
        "per_capita_as_of": NATIONAL_LPCD_AS_OF,
        "per_capita_source": NATIONAL_LPCD_SOURCE,
        "per_capita_source_url": NATIONAL_LPCD_SOURCE_URL,
        "per_capita_caveat": NATIONAL_LPCD_CAVEAT,
    },
    {
        "id": "buffalo_city", "code": "BCM", "name": "Buffalo City",
        "province": "Eastern Cape", "latitude": -32.9795, "longitude": 27.8671,
        "population": 975_255,
        "population_as_of": "Census 2022", "population_source": "Stats SA Census 2022",
        "population_source_url": "https://census.statssa.gov.za/",
        "nrw_pct": 47.0,
        "nrw_as_of": "2023",
        "nrw_source": "DWS national NRW baseline 2023",
        "nrw_source_url": "https://ws.dws.gov.za/iris/releases/NDWR.pdf",
        "nrw_caveat": "National baseline — Buffalo City classified critical by DWS 2023 No Drop. Pending metro-specific figure.",
        "per_capita_lpcd": NATIONAL_LPCD,
        "per_capita_as_of": NATIONAL_LPCD_AS_OF,
        "per_capita_source": NATIONAL_LPCD_SOURCE,
        "per_capita_source_url": NATIONAL_LPCD_SOURCE_URL,
        "per_capita_caveat": NATIONAL_LPCD_CAVEAT,
    },
    {
        "id": "mangaung", "code": "MAN", "name": "Mangaung",
        "province": "Free State", "latitude": -29.1217, "longitude": 26.2137,
        "population": 811_431,
        "population_as_of": "Census 2022", "population_source": "Stats SA Census 2022",
        "population_source_url": "https://census.statssa.gov.za/",
        "nrw_pct": 47.0,
        "nrw_as_of": "2023",
        "nrw_source": "DWS national NRW baseline 2023",
        "nrw_source_url": "https://ws.dws.gov.za/iris/releases/NDWR.pdf",
        "nrw_caveat": "National baseline — pending metro-specific figure from Mangaung 2022/23 annual report.",
        "per_capita_lpcd": NATIONAL_LPCD,
        "per_capita_as_of": NATIONAL_LPCD_AS_OF,
        "per_capita_source": NATIONAL_LPCD_SOURCE,
        "per_capita_source_url": NATIONAL_LPCD_SOURCE_URL,
        "per_capita_caveat": NATIONAL_LPCD_CAVEAT,
    },
]


# Major dams supplying each metro. Full capacities from DWS dam registers.
# Metros without distinct dams (e.g. Joburg/Tshwane/Ekurhuleni all served by
# Vaal+Sterkfontein via Rand Water) share entries via metro_dams.
DAMS: list[dict] = [
    # Vaal system serves Joburg, Tshwane, Ekurhuleni via Rand Water
    {"id": "vaal", "name": "Vaal Dam",
     "province": "Free State / Gauteng", "full_capacity_ml": 2_536_180.0},
    {"id": "sterkfontein", "name": "Sterkfontein Dam",
     "province": "Free State", "full_capacity_ml": 2_656_640.0},
    {"id": "bloemhof", "name": "Bloemhof Dam",
     "province": "North West / Free State", "full_capacity_ml": 1_269_950.0},
    # Cape Town system
    {"id": "theewaterskloof", "name": "Theewaterskloof Dam",
     "province": "Western Cape", "full_capacity_ml": 1_006_770.0},
    {"id": "voelvlei", "name": "Voëlvlei Dam",
     "province": "Western Cape", "full_capacity_ml": 328_905.0},
    {"id": "berg_river", "name": "Berg River Dam",
     "province": "Western Cape", "full_capacity_ml": 130_010.0},
    {"id": "wemmershoek", "name": "Wemmershoek Dam",
     "province": "Western Cape", "full_capacity_ml": 58_644.0},
    {"id": "steenbras_lower", "name": "Steenbras Lower Dam",
     "province": "Western Cape", "full_capacity_ml": 33_517.0},
    {"id": "steenbras_upper", "name": "Steenbras Upper Dam",
     "province": "Western Cape", "full_capacity_ml": 31_767.0},
    # eThekwini / Umgeni system
    {"id": "inanda", "name": "Inanda Dam",
     "province": "KwaZulu-Natal", "full_capacity_ml": 241_700.0},
    {"id": "albert_falls", "name": "Albert Falls Dam",
     "province": "KwaZulu-Natal", "full_capacity_ml": 288_100.0},
    {"id": "midmar", "name": "Midmar Dam",
     "province": "KwaZulu-Natal", "full_capacity_ml": 235_400.0},
    {"id": "hazelmere", "name": "Hazelmere Dam",
     "province": "KwaZulu-Natal", "full_capacity_ml": 23_600.0},
    {"id": "nagle", "name": "Nagle Dam",
     "province": "KwaZulu-Natal", "full_capacity_ml": 22_500.0},
    # Nelson Mandela Bay
    {"id": "kouga", "name": "Kouga Dam",
     "province": "Eastern Cape", "full_capacity_ml": 128_900.0},
    {"id": "impofu", "name": "Mpofu (Impofu) Dam",
     "province": "Eastern Cape", "full_capacity_ml": 105_800.0},
    {"id": "churchill", "name": "Churchill Dam",
     "province": "Eastern Cape", "full_capacity_ml": 35_900.0},
    {"id": "groendal", "name": "Groendal Dam",
     "province": "Eastern Cape", "full_capacity_ml": 12_000.0},
    # Buffalo City
    {"id": "bridle_drift", "name": "Bridle Drift Dam",
     "province": "Eastern Cape", "full_capacity_ml": 67_300.0},
    {"id": "wriggleswade", "name": "Wriggleswade Dam",
     "province": "Eastern Cape", "full_capacity_ml": 91_500.0},
    {"id": "laing", "name": "Laing Dam",
     "province": "Eastern Cape", "full_capacity_ml": 21_700.0},
    # Mangaung
    {"id": "mockes", "name": "Mockes Dam",
     "province": "Free State", "full_capacity_ml": 8_700.0},
    {"id": "welbedacht", "name": "Welbedacht Dam",
     "province": "Free State", "full_capacity_ml": 14_200.0},
]


# (metro_id, dam_id, is_primary). Joburg/Tshwane/Ekurhuleni share Vaal system
# via Rand Water bulk supply.
METRO_DAMS: list[tuple[str, str, bool]] = [
    ("johannesburg", "vaal", True),
    ("johannesburg", "sterkfontein", False),
    ("johannesburg", "bloemhof", False),
    ("tshwane", "vaal", True),
    ("tshwane", "sterkfontein", False),
    ("ekurhuleni", "vaal", True),
    ("ekurhuleni", "sterkfontein", False),
    ("cape_town", "theewaterskloof", True),
    ("cape_town", "voelvlei", False),
    ("cape_town", "berg_river", False),
    ("cape_town", "wemmershoek", False),
    ("cape_town", "steenbras_lower", False),
    ("cape_town", "steenbras_upper", False),
    ("ethekwini", "inanda", True),
    ("ethekwini", "albert_falls", False),
    ("ethekwini", "midmar", False),
    ("ethekwini", "hazelmere", False),
    ("ethekwini", "nagle", False),
    ("nelson_mandela_bay", "kouga", True),
    ("nelson_mandela_bay", "impofu", False),
    ("nelson_mandela_bay", "churchill", False),
    ("nelson_mandela_bay", "groendal", False),
    ("buffalo_city", "bridle_drift", True),
    ("buffalo_city", "wriggleswade", False),
    ("buffalo_city", "laing", False),
    ("mangaung", "mockes", True),
    ("mangaung", "welbedacht", False),
]


DATA_SOURCES: list[dict] = [
    {
        "key": "stats_sa_census_2022",
        "name": "Stats SA Census 2022",
        "url": "https://census.statssa.gov.za/",
        "description": "Census 2022 metropolitan municipality populations.",
    },
    {
        "key": "dws_blue_drop_2023",
        "name": "DWS Blue Drop Report 2023",
        "url": "https://ws.dws.gov.za/iris/releases/BDN_2023_Report.pdf",
        "description": "Drinking water quality assessment per municipality.",
    },
    {
        "key": "dws_no_drop_2023",
        "name": "DWS No Drop Report 2023",
        "url": "https://ws.dws.gov.za/iris/releases/ND_2023_Report.pdf",
        "description": "Water-use efficiency and Non-Revenue Water assessment.",
    },
    {
        "key": "dws_weekly_dams",
        "name": "DWS Weekly State of Dams",
        "url": "https://www.dws.gov.za/Hydrology/Weekly/Weekly.pdf",
        "description": "Weekly storage % per major dam, refreshed every Monday.",
    },
    {
        "key": "coct_daily_dams",
        "name": "City of Cape Town — Daily Dam Levels",
        "url": "https://www.capetown.gov.za/Family%20and%20home/Residential-utility-services/Residential-water-and-sanitation-services/this-weeks-dam-levels",
        "description": "Daily storage Mℓ + % for the 6 dams supplying Cape Town.",
    },
]


def _upsert_metro(session, row: dict) -> None:
    stmt = pg_insert(Metro).values(**row)
    stmt = stmt.on_conflict_do_update(
        index_elements=["id"],
        set_={k: stmt.excluded[k] for k in row if k != "id"},
    )
    session.execute(stmt)


def _upsert_dam(session, row: dict) -> None:
    stmt = pg_insert(Dam).values(**row)
    stmt = stmt.on_conflict_do_update(
        index_elements=["id"],
        set_={k: stmt.excluded[k] for k in row if k != "id"},
    )
    session.execute(stmt)


def _upsert_metro_dam(session, metro_id: str, dam_id: str, is_primary: bool) -> None:
    stmt = pg_insert(MetroDam).values(
        metro_id=metro_id, dam_id=dam_id, is_primary=is_primary,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["metro_id", "dam_id"],
        set_={"is_primary": stmt.excluded.is_primary},
    )
    session.execute(stmt)


def _upsert_data_source(session, row: dict) -> None:
    stmt = pg_insert(DataSource).values(**row)
    stmt = stmt.on_conflict_do_update(
        index_elements=["key"],
        set_={k: stmt.excluded[k] for k in row if k != "key"},
    )
    session.execute(stmt)


def main() -> int:
    db = SessionLocal()
    try:
        for metro in METROS:
            _upsert_metro(db, metro)
        for dam in DAMS:
            _upsert_dam(db, dam)
        for metro_id, dam_id, is_primary in METRO_DAMS:
            _upsert_metro_dam(db, metro_id, dam_id, is_primary)
        for ds in DATA_SOURCES:
            _upsert_data_source(db, ds)
        db.commit()
        print(f"Seeded {len(METROS)} metros, {len(DAMS)} dams, "
              f"{len(METRO_DAMS)} metro-dam links, {len(DATA_SOURCES)} data sources.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
