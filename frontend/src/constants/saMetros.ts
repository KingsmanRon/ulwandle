/**
 * South Africa 8 Metropolitan Municipalities Data
 * Real population data and geographic coordinates
 */

export interface Metro {
  id: string;
  name: string;
  province: string;
  population: number;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export const EIGHT_METROS: Metro[] = [
  {
    id: 'jhb',
    name: 'City of Johannesburg',
    province: 'Gauteng',
    population: 5635127,
    coordinates: { lat: -26.2041, lng: 28.0473 }
  },
  {
    id: 'cpt',
    name: 'City of Cape Town',
    province: 'Western Cape',
    population: 4618000,
    coordinates: { lat: -33.9249, lng: 18.4241 }
  },
  {
    id: 'ekhur',
    name: 'Ekurhuleni',
    province: 'Gauteng',
    population: 3842000,
    coordinates: { lat: -26.2309, lng: 28.3622 }
  },
  {
    id: 'ethek',
    name: 'eThekwini (Durban)',
    province: 'KwaZulu-Natal',
    population: 3990000,
    coordinates: { lat: -29.8587, lng: 31.0218 }
  },
  {
    id: 'tshwane',
    name: 'City of Tshwane (Pretoria)',
    province: 'Gauteng',
    population: 3275000,
    coordinates: { lat: -25.7479, lng: 28.2293 }
  },
  {
    id: 'nelson',
    name: 'Nelson Mandela Bay (Port Elizabeth)',
    province: 'Eastern Cape',
    population: 1263000,
    coordinates: { lat: -33.9608, lng: 25.6022 }
  },
  {
    id: 'buffalo',
    name: 'Buffalo City (East London)',
    province: 'Eastern Cape',
    population: 832000,
    coordinates: { lat: -32.9733, lng: 27.8687 }
  },
  {
    id: 'manguang',
    name: 'Mangaung (Bloemfontein)',
    province: 'Free State',
    population: 783000,
    coordinates: { lat: -29.1211, lng: 26.2145 }
  }
];

/**
 * Water Stress Level Classification
 */
export type WaterStressLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface WaterStressConfig {
  level: WaterStressLevel;
  color: string;
  bgColor: string;
  threshold: number; // liters per capita per day
}

export const WATER_STRESS_LEVELS: Record<WaterStressLevel, WaterStressConfig> = {
  CRITICAL: {
    level: 'CRITICAL',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    threshold: 100
  },
  HIGH: {
    level: 'HIGH',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    threshold: 150
  },
  MEDIUM: {
    level: 'MEDIUM',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    threshold: 200
  },
  LOW: {
    level: 'LOW',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    threshold: Infinity
  }
};

/**
 * WHO and SA Water Standards
 */
export const WATER_STANDARDS = {
  WHO_MIN_RECOMMENDED: 100, // liters per person per day
  WHO_MAX_RECOMMENDED: 150,
  NRW_TARGET: 15, // Non-Revenue Water target percentage
  NRW_ACCEPTABLE: 25, // Acceptable NRW percentage
  NRW_CRITICAL: 35 // Critical NRW percentage
};

/**
 * Determine water stress level based on per capita usage
 */
export function getWaterStressLevel(perCapitaLiters: number): WaterStressLevel {
  if (perCapitaLiters < WATER_STRESS_LEVELS.CRITICAL.threshold) return 'CRITICAL';
  if (perCapitaLiters < WATER_STRESS_LEVELS.HIGH.threshold) return 'HIGH';
  if (perCapitaLiters < WATER_STRESS_LEVELS.MEDIUM.threshold) return 'MEDIUM';
  return 'LOW';
}

/**
 * Get metro by ID
 */
export function getMetroById(id: string): Metro | undefined {
  return EIGHT_METROS.find(metro => metro.id === id);
}

/**
 * Generate realistic water data for a metro
 */
export interface MetroWaterData {
  metro: string;
  metroId: string;
  province: string;
  population: number;
  timestamp: number;
  intake: number; // Megalitres per day
  usage: number;
  wastage: number;
  wastagePercentage: number;
  perCapita: number; // Liters per person per day
  stressLevel: WaterStressLevel;
  verified: boolean;
  blockchainHash: string | null;
}

export function generateMetroWaterData(metro: Metro): MetroWaterData {
  const baseIntake = (metro.population / 1000) * 0.35; // ML per day
  const seasonalVar = Math.sin(Date.now() / 86400000 / 7) * 0.15; // Weekly seasonal variation
  const randomVar = (Math.random() - 0.5) * 0.1;

  const intake = baseIntake * (1 + seasonalVar + randomVar);
  const wastagePercent = 15 + Math.random() * 20; // 15-35% wastage (realistic for SA)
  const wastage = intake * (wastagePercent / 100);
  const usage = intake - wastage;
  const perCapita = (usage * 1000000) / metro.population; // liters per person per day

  return {
    metro: metro.name,
    metroId: metro.id,
    province: metro.province,
    population: metro.population,
    timestamp: Date.now(),
    intake: parseFloat(intake.toFixed(2)),
    usage: parseFloat(usage.toFixed(2)),
    wastage: parseFloat(wastage.toFixed(2)),
    wastagePercentage: parseFloat(wastagePercent.toFixed(1)),
    perCapita: parseFloat(perCapita.toFixed(1)),
    stressLevel: getWaterStressLevel(perCapita),
    verified: true,
    blockchainHash: null
  };
}
