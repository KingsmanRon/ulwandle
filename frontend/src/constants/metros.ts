/**
 * Canonical SA metropolitan municipality definitions.
 *
 * This is the single source of truth for metro IDs across the frontend.
 * The backend `network_generator.py` METRO_CONFIGS uses the same `id`
 * values as map keys.
 */

export type MetroId =
  | 'johannesburg'
  | 'cape_town'
  | 'ekurhuleni'
  | 'ethekwini'
  | 'tshwane'
  | 'nelson_mandela_bay'
  | 'buffalo_city'
  | 'mangaung';

export interface Metro {
  id: MetroId;
  code: string;        // 3-letter display code (JHB, CPT, ...)
  name: string;        // full official municipality name
  shortName: string;   // short display name
  province: string;
  population: number;  // StatsSA mid-year estimates
  coordinates: { lat: number; lng: number };
  baseIntakeMlPerDay: number;
}

export const METROS: Metro[] = [
  {
    id: 'johannesburg',
    code: 'JHB',
    name: 'City of Johannesburg',
    shortName: 'Johannesburg',
    province: 'Gauteng',
    population: 5_635_127,
    coordinates: { lat: -26.2041, lng: 28.0473 },
    baseIntakeMlPerDay: 1972.25,
  },
  {
    id: 'cape_town',
    code: 'CPT',
    name: 'City of Cape Town',
    shortName: 'Cape Town',
    province: 'Western Cape',
    population: 4_618_188,
    coordinates: { lat: -33.9249, lng: 18.4241 },
    baseIntakeMlPerDay: 1702.17,
  },
  {
    id: 'ekurhuleni',
    code: 'EKU',
    name: 'Ekurhuleni',
    shortName: 'Ekurhuleni',
    province: 'Gauteng',
    population: 3_816_476,
    coordinates: { lat: -26.1841, lng: 28.1935 },
    baseIntakeMlPerDay: 1407.01,
  },
  {
    id: 'ethekwini',
    code: 'ETH',
    name: 'eThekwini',
    shortName: 'Durban',
    province: 'KwaZulu-Natal',
    population: 3_995_000,
    coordinates: { lat: -29.8587, lng: 31.0218 },
    baseIntakeMlPerDay: 1472.57,
  },
  {
    id: 'tshwane',
    code: 'TSH',
    name: 'City of Tshwane',
    shortName: 'Pretoria',
    province: 'Gauteng',
    population: 3_275_152,
    coordinates: { lat: -25.7479, lng: 28.2293 },
    baseIntakeMlPerDay: 1207.17,
  },
  {
    id: 'nelson_mandela_bay',
    code: 'NMB',
    name: 'Nelson Mandela Bay',
    shortName: 'Port Elizabeth',
    province: 'Eastern Cape',
    population: 1_292_816,
    coordinates: { lat: -33.9615, lng: 25.6022 },
    baseIntakeMlPerDay: 476.38,
  },
  {
    id: 'buffalo_city',
    code: 'BCM',
    name: 'Buffalo City',
    shortName: 'East London',
    province: 'Eastern Cape',
    population: 832_229,
    coordinates: { lat: -32.9795, lng: 27.8671 },
    baseIntakeMlPerDay: 306.70,
  },
  {
    id: 'mangaung',
    code: 'MAN',
    name: 'Mangaung',
    shortName: 'Bloemfontein',
    province: 'Free State',
    population: 783_294,
    coordinates: { lat: -29.1217, lng: 26.2137 },
    baseIntakeMlPerDay: 288.60,
  },
];

export function getMetroById(id: string): Metro | undefined {
  return METROS.find(m => m.id === id);
}

// ---------- Water stress classification ----------

export type WaterStressLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface WaterStressConfig {
  level: WaterStressLevel;
  label: string;
  /** Foreground text colour. */
  color: string;
  /** Background tint. */
  bgColor: string;
  /** Per-capita litres-per-day below which this level applies. */
  threshold: number;
}

export const WATER_STRESS_LEVELS: Record<WaterStressLevel, WaterStressConfig> = {
  CRITICAL: { level: 'CRITICAL', label: 'Critical', color: '#b91c1c', bgColor: '#fee2e2', threshold: 100 },
  HIGH:     { level: 'HIGH',     label: 'High',     color: '#c2410c', bgColor: '#ffedd5', threshold: 150 },
  MEDIUM:   { level: 'MEDIUM',   label: 'Medium',   color: '#a16207', bgColor: '#fef3c7', threshold: 200 },
  LOW:      { level: 'LOW',      label: 'Low',      color: '#15803d', bgColor: '#dcfce7', threshold: Infinity },
};

export function getWaterStressLevel(perCapitaLitres: number): WaterStressLevel {
  if (perCapitaLitres < WATER_STRESS_LEVELS.CRITICAL.threshold) return 'CRITICAL';
  if (perCapitaLitres < WATER_STRESS_LEVELS.HIGH.threshold) return 'HIGH';
  if (perCapitaLitres < WATER_STRESS_LEVELS.MEDIUM.threshold) return 'MEDIUM';
  return 'LOW';
}

// ---------- WHO / SA water reporting standards ----------

export const WATER_STANDARDS = {
  WHO_MIN_RECOMMENDED: 100, // litres per person per day
  WHO_MAX_RECOMMENDED: 150,
  NRW_TARGET: 15,           // Non-Revenue Water target percentage
  NRW_ACCEPTABLE: 25,
  NRW_CRITICAL: 35,
};

// ---------- Synthetic per-metro water snapshot (transitional) ----------
//
// Used by metro-overview UI components until the backend `/api/v1/metros`
// endpoint is wired (Phase 6 of the rich-UI port). Once components fetch
// real data, this generator should be deleted along with its callers.

export interface MetroWaterData {
  metroId: MetroId;
  metro: string;
  province: string;
  population: number;
  timestamp: number;
  intake: number;             // ML/day
  usage: number;              // ML/day
  wastage: number;            // ML/day
  wastagePercentage: number;  // 0–100
  perCapita: number;          // L/person/day
  stressLevel: WaterStressLevel;
}

export function generateSyntheticMetroWaterData(metro: Metro): MetroWaterData {
  const seasonalVar = Math.sin(Date.now() / 86_400_000 / 7) * 0.15;
  const randomVar = (Math.random() - 0.5) * 0.1;

  const intake = metro.baseIntakeMlPerDay * (1 + seasonalVar + randomVar);
  const wastagePercent = 15 + Math.random() * 20; // 15–35% — typical SA NRW range
  const wastage = intake * (wastagePercent / 100);
  const usage = intake - wastage;
  const perCapita = (usage * 1_000_000) / metro.population;

  return {
    metroId: metro.id,
    metro: metro.name,
    province: metro.province,
    population: metro.population,
    timestamp: Date.now(),
    intake: parseFloat(intake.toFixed(2)),
    usage: parseFloat(usage.toFixed(2)),
    wastage: parseFloat(wastage.toFixed(2)),
    wastagePercentage: parseFloat(wastagePercent.toFixed(1)),
    perCapita: parseFloat(perCapita.toFixed(1)),
    stressLevel: getWaterStressLevel(perCapita),
  };
}
