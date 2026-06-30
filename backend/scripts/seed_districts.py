"""
Seed District rows for all 8 South African metros.

Idempotent: safe to re-run. Each call upserts by ``code``. Status defaults
to UNMONITORED and only changes when real water-quality readings arrive at
``/api/v1/water-quality/readings`` (see ``app.api.water_quality``).

Run:
    python -m scripts.seed_districts

Source attribution
==================

Population (locality rows): Stats SA **Census 2011** Main Place totals,
via citypopulation.de / adrianfrith.com. These are the LATEST official
place-level census figures that exist — Census 2022 was NOT released at
the named-place / Main Place level. citypopulation.de publishes South
African places for the 2001 and 2011 censuses only; municipalities go to
2022. Census 2022 also carried a ~31% undercount and Stats SA flagged
inconsistent data below ward level, so there is no reliable 2022 figure
for Soweto, Khayelitsha, Mdantsane, etc. The 2011 numbers here are
therefore correct and FINAL at this granularity — not placeholders.
(An earlier version of this docstring attributed these to "Census 2022";
that was wrong and has been corrected.)

Current Census 2022 figures DO exist at the metro level, but they are NOT
duplicated here. They live authoritatively in the ``metros`` table
(see ``scripts.seed_metros`` -> ``Metro.population`` / ``population_as_of``)
and are surfaced with full source attribution by
``/api/v1/metros/baseline``. Surface those on the metro header and keep the
2011 figures on the locality rows; do not mix the two vintages silently.
The two APPROX rows (Pretoria Central, Gqeberha Central) are sub-areas with
no official census figure at all and stay estimates regardless of census
year.

Centroid latitude/longitude: rounded to 4 decimal places from public map
references (OpenStreetMap / Google Maps centroids of the Main Place).

This file is the *reference* layer for the District Overview. It does
NOT seed time-series readings — those would come from a future utility
SCADA feed (see ``Dashboard.tsx`` footer note on the operational gap).

Dashboard note
==============
UNMONITORED is distinct from GREEN so an empty telemetry state can never be
presented as a passing water-quality result.
"""

from __future__ import annotations

from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db.database import SessionLocal
from app.models.models import District


# ---------------------------------------------------------------------------
# CORRECTIONS (2026-06-18) — codes intentionally left UNCHANGED. ``code`` is the
# upsert conflict key and the FK target from water-quality readings; renaming a
# code would orphan existing telemetry. Only display names / populations changed.
#
#   * BCM-KWT  "King William's Town" -> "Qonce" (officially renamed 2021).
#   * TSH-PTA  "Pretoria" -> "Pretoria Central"; 741,300 re-scoped. That figure
#              was greater-Pretoria and read as the parent of Mamelodi /
#              Atteridgeville / Soshanguve (their own rows below), so the
#              dashboard's summed district population double-counted them.
#              340,000 is an APPROX placeholder for the central core — replace
#              with the central-Pretoria Main Place when sourced.
#   * NMB-GQH  "Gqeberha" -> "Gqeberha Central"; 391,000 (whole-city) double-
#              counted New Brighton / KwaZakhele / Motherwell, which are already
#              their own rows. 120,000 is an APPROX placeholder for the core.
#   * NMB-WLM  Walmer added so southern Gqeberha is covered without a parent row.
#   * TSH-HMK  comment death toll corrected to 23+ (some counts up to 32; was
#              "15+").
#
# STILL OPEN:
#   - Model/table is `District`, but these are localities / supply zones, not
#     Category-C district municipalities. A later rename (MonitoringZone /
#     SupplyZone) removes that terminology clash.
#   - Heidedal (MAN-HDL) is a Bloemfontein suburb and nests inside MAN-BFN;
#     kept for recognisability. Fold in if you want strict non-overlap.
# ---------------------------------------------------------------------------


# Each entry mirrors the District model columns. Population is the
# Census 2011 Main Place total (see attribution). Coordinates are centroids.
DISTRICTS: list[dict] = [
    # === City of Johannesburg (JHB) — Gauteng ===
    {"code": "JHB-SOW", "name": "Soweto",
     "municipality": "City of Johannesburg", "province": "Gauteng",
     "population": 1_271_628, "latitude": -26.2678, "longitude": 27.8585},
    {"code": "JHB-RDP", "name": "Roodepoort",
     "municipality": "City of Johannesburg", "province": "Gauteng",
     "population": 326_461, "latitude": -26.1625, "longitude": 27.8725},
    {"code": "JHB-RBG", "name": "Randburg",
     "municipality": "City of Johannesburg", "province": "Gauteng",
     "population": 337_439, "latitude": -26.0936, "longitude": 28.0064},
    {"code": "JHB-SDT", "name": "Sandton",
     "municipality": "City of Johannesburg", "province": "Gauteng",
     "population": 222_415, "latitude": -26.1076, "longitude": 28.0567},
    {"code": "JHB-ALX", "name": "Alexandra",
     "municipality": "City of Johannesburg", "province": "Gauteng",
     "population": 179_624, "latitude": -26.1067, "longitude": 28.0967},
    {"code": "JHB-DST", "name": "Diepsloot",
     "municipality": "City of Johannesburg", "province": "Gauteng",
     "population": 138_329, "latitude": -25.9333, "longitude": 28.0167},

    # === City of Cape Town (CPT) — Western Cape ===
    {"code": "CPT-KHY", "name": "Khayelitsha",
     "municipality": "City of Cape Town", "province": "Western Cape",
     "population": 391_749, "latitude": -34.0356, "longitude": 18.6770},
    {"code": "CPT-MPL", "name": "Mitchells Plain",
     "municipality": "City of Cape Town", "province": "Western Cape",
     "population": 310_485, "latitude": -34.0500, "longitude": 18.6167},
    {"code": "CPT-DLF", "name": "Delft",
     "municipality": "City of Cape Town", "province": "Western Cape",
     "population": 152_030, "latitude": -33.9722, "longitude": 18.6519},
    {"code": "CPT-BLV", "name": "Bellville",
     "municipality": "City of Cape Town", "province": "Western Cape",
     "population": 219_000, "latitude": -33.8983, "longitude": 18.6444},
    {"code": "CPT-GUG", "name": "Gugulethu",
     "municipality": "City of Cape Town", "province": "Western Cape",
     "population": 98_468, "latitude": -33.9833, "longitude": 18.5667},
    {"code": "CPT-CBD", "name": "Cape Town CBD",
     "municipality": "City of Cape Town", "province": "Western Cape",
     "population": 46_020, "latitude": -33.9249, "longitude": 18.4241},

    # === eThekwini (ETH) — KwaZulu-Natal ===
    {"code": "ETH-UMZ", "name": "Umlazi",
     "municipality": "eThekwini", "province": "KwaZulu-Natal",
     "population": 404_811, "latitude": -29.9667, "longitude": 30.8833},
    {"code": "ETH-CWD", "name": "Chatsworth",
     "municipality": "eThekwini", "province": "KwaZulu-Natal",
     "population": 173_000, "latitude": -29.9167, "longitude": 30.8833},
    {"code": "ETH-KWM", "name": "KwaMashu",
     "municipality": "eThekwini", "province": "KwaZulu-Natal",
     "population": 175_663, "latitude": -29.7500, "longitude": 30.9667},
    {"code": "ETH-INA", "name": "Inanda",
     "municipality": "eThekwini", "province": "KwaZulu-Natal",
     "population": 158_000, "latitude": -29.7167, "longitude": 30.9667},
    {"code": "ETH-PNT", "name": "Pinetown",
     "municipality": "eThekwini", "province": "KwaZulu-Natal",
     "population": 105_486, "latitude": -29.8167, "longitude": 30.8500},
    {"code": "ETH-DBN", "name": "Durban CBD",
     "municipality": "eThekwini", "province": "KwaZulu-Natal",
     "population": 37_750, "latitude": -29.8587, "longitude": 31.0218},

    # === City of Tshwane (TSH) — Gauteng ===
    # Renamed "Pretoria" -> "Pretoria Central". The old 741,300 spanned greater
    # Pretoria, which made this read as the parent of the township rows below
    # and double-counted them in the dashboard population total. 340,000 is an
    # APPROX placeholder for the central + inner suburbs — replace with the
    # central-Pretoria Census Main Place figure when sourced.
    {"code": "TSH-PTA", "name": "Pretoria Central",
     "municipality": "City of Tshwane", "province": "Gauteng",
     "population": 340_000, "latitude": -25.7479, "longitude": 28.2293},
    {"code": "TSH-SSH", "name": "Soshanguve",
     "municipality": "City of Tshwane", "province": "Gauteng",
     "population": 422_000, "latitude": -25.5167, "longitude": 28.1000},
    {"code": "TSH-MML", "name": "Mamelodi",
     "municipality": "City of Tshwane", "province": "Gauteng",
     "population": 334_577, "latitude": -25.7167, "longitude": 28.3833},
    {"code": "TSH-CEN", "name": "Centurion",
     "municipality": "City of Tshwane", "province": "Gauteng",
     "population": 236_580, "latitude": -25.8603, "longitude": 28.1894},
    {"code": "TSH-ATR", "name": "Atteridgeville",
     "municipality": "City of Tshwane", "province": "Gauteng",
     "population": 64_425, "latitude": -25.7833, "longitude": 28.0500},
    # Hammanskraal — site of the May 2023 cholera outbreak (23+ confirmed
    # deaths; some counts up to 32). Rooiwal WWTW effluent contaminated the
    # Apies River / Temba supply; ~20 years without reliable potable water and
    # only partial remediation (Klipdrift package-plant Phase 1) to date.
    # Strong demo for SANS 241 telemetry and the kill-switch use case.
    {"code": "TSH-HMK", "name": "Hammanskraal",
     "municipality": "City of Tshwane", "province": "Gauteng",
     "population": 70_000, "latitude": -25.4000, "longitude": 28.2833},

    # === City of Ekurhuleni (EKU) — Gauteng ===
    {"code": "EKU-TMB", "name": "Tembisa",
     "municipality": "City of Ekurhuleni", "province": "Gauteng",
     "population": 511_655, "latitude": -25.9994, "longitude": 28.2169},
    {"code": "EKU-KTL", "name": "Katlehong",
     "municipality": "City of Ekurhuleni", "province": "Gauteng",
     "population": 407_294, "latitude": -26.3500, "longitude": 28.1500},
    {"code": "EKU-BKB", "name": "Boksburg",
     "municipality": "City of Ekurhuleni", "province": "Gauteng",
     "population": 260_321, "latitude": -26.2125, "longitude": 28.2625},
    {"code": "EKU-KMP", "name": "Kempton Park",
     "municipality": "City of Ekurhuleni", "province": "Gauteng",
     "population": 167_000, "latitude": -26.1014, "longitude": 28.2294},
    {"code": "EKU-VSL", "name": "Vosloorus",
     "municipality": "City of Ekurhuleni", "province": "Gauteng",
     "population": 144_407, "latitude": -26.3667, "longitude": 28.1667},
    {"code": "EKU-DVT", "name": "Daveyton",
     "municipality": "City of Ekurhuleni", "province": "Gauteng",
     "population": 127_967, "latitude": -26.1500, "longitude": 28.4000},

    # === Nelson Mandela Bay (NMB) — Eastern Cape ===
    # Renamed "Gqeberha" -> "Gqeberha Central". The old 391,000 was the whole
    # city and double-counted New Brighton / KwaZakhele / Motherwell, which are
    # their own rows below. 120,000 is an APPROX placeholder for the central
    # core — replace with the central-Gqeberha Census Main Place figure.
    {"code": "NMB-GQH", "name": "Gqeberha Central",
     "municipality": "Nelson Mandela Bay", "province": "Eastern Cape",
     "population": 120_000, "latitude": -33.9615, "longitude": 25.6022},
    {"code": "NMB-UTH", "name": "Kariega (Uitenhage)",
     "municipality": "Nelson Mandela Bay", "province": "Eastern Cape",
     "population": 132_000, "latitude": -33.7559, "longitude": 25.4017},
    {"code": "NMB-MTW", "name": "Motherwell",
     "municipality": "Nelson Mandela Bay", "province": "Eastern Cape",
     "population": 113_229, "latitude": -33.7667, "longitude": 25.6333},
    # Walmer added so southern Gqeberha is covered without a whole-city parent.
    {"code": "NMB-WLM", "name": "Walmer",
     "municipality": "Nelson Mandela Bay", "province": "Eastern Cape",
     "population": 70_000, "latitude": -33.9833, "longitude": 25.5833},
    {"code": "NMB-KZK", "name": "KwaZakhele",
     "municipality": "Nelson Mandela Bay", "province": "Eastern Cape",
     "population": 65_000, "latitude": -33.8500, "longitude": 25.5667},
    {"code": "NMB-NBR", "name": "New Brighton",
     "municipality": "Nelson Mandela Bay", "province": "Eastern Cape",
     "population": 51_000, "latitude": -33.8833, "longitude": 25.5833},
    {"code": "NMB-DPT", "name": "Despatch",
     "municipality": "Nelson Mandela Bay", "province": "Eastern Cape",
     "population": 38_300, "latitude": -33.7833, "longitude": 25.5500},

    # === Buffalo City (BCM) — Eastern Cape ===
    {"code": "BCM-ELN", "name": "East London",
     "municipality": "Buffalo City", "province": "Eastern Cape",
     "population": 290_000, "latitude": -32.9795, "longitude": 27.8671},
    {"code": "BCM-MDN", "name": "Mdantsane",
     "municipality": "Buffalo City", "province": "Eastern Cape",
     "population": 196_059, "latitude": -32.9667, "longitude": 27.7833},
    # Code kept as BCM-KWT (stable upsert/FK key); officially renamed to Qonce
    # in 2021.
    {"code": "BCM-KWT", "name": "Qonce",
     "municipality": "Buffalo City", "province": "Eastern Cape",
     "population": 35_309, "latitude": -32.8833, "longitude": 27.4000},
    {"code": "BCM-ZWL", "name": "Zwelitsha",
     "municipality": "Buffalo City", "province": "Eastern Cape",
     "population": 24_000, "latitude": -32.8833, "longitude": 27.4167},
    {"code": "BCM-DMB", "name": "Dimbaza",
     "municipality": "Buffalo City", "province": "Eastern Cape",
     "population": 18_500, "latitude": -32.8833, "longitude": 27.2333},
    {"code": "BCM-BHO", "name": "Bhisho",
     "municipality": "Buffalo City", "province": "Eastern Cape",
     "population": 16_000, "latitude": -32.8500, "longitude": 27.4500},

    # === Mangaung (MAN) — Free State ===
    {"code": "MAN-BFN", "name": "Bloemfontein",
     "municipality": "Mangaung", "province": "Free State",
     "population": 256_000, "latitude": -29.0852, "longitude": 26.1596},
    {"code": "MAN-BSH", "name": "Botshabelo",
     "municipality": "Mangaung", "province": "Free State",
     "population": 181_712, "latitude": -29.2667, "longitude": 26.7167},
    {"code": "MAN-TNC", "name": "Thaba Nchu",
     "municipality": "Mangaung", "province": "Free State",
     "population": 86_920, "latitude": -29.2167, "longitude": 26.8333},
    # NOTE: Heidedal is a suburb of Bloemfontein and therefore nests inside
    # MAN-BFN. Kept for recognisability; fold into MAN-BFN for strict
    # non-overlap.
    {"code": "MAN-HDL", "name": "Heidedal",
     "municipality": "Mangaung", "province": "Free State",
     "population": 40_000, "latitude": -29.1333, "longitude": 26.2333},
]


def _upsert_district(session, row: dict) -> None:
    stmt = pg_insert(District).values(**row)
    stmt = stmt.on_conflict_do_update(
        index_elements=["code"],
        set_={k: stmt.excluded[k] for k in row if k != "code"},
    )
    session.execute(stmt)


def main() -> int:
    db = SessionLocal()
    try:
        for row in DISTRICTS:
            _upsert_district(db, row)
        db.commit()
        per_metro: dict[str, int] = {}
        for r in DISTRICTS:
            per_metro[r["municipality"]] = per_metro.get(r["municipality"], 0) + 1
        print(f"Seeded {len(DISTRICTS)} districts across {len(per_metro)} metros:")
        for m, n in sorted(per_metro.items()):
            print(f"  {n:>2}  {m}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
