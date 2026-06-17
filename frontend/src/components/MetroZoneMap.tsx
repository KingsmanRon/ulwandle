import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';
import { Metro, MetroId } from '../constants/metros';
import { apiService } from '../services/apiService';
import './MetroZoneMap.css';

interface ZoneData {
  zone_id: string;
  name: string;
  population: number;
  daily_intake_ml: number;
  daily_usage_ml: number;
  daily_wastage_ml: number;
  wastage_percentage: number;
  has_active_leaks: boolean;
  leak_count: number;
  priority_score: number;
  bounds_geojson: any;
}

interface MetroZoneMapProps {
  metro: Metro;
  onZonesUpdate?: (zones: ZoneData[]) => void;
}

// Last-resort offline data so the panel still renders something useful
// when the network call fails (e.g. backend unreachable). A 401 here is
// not a fallback case — the axios auth interceptor handles refresh.
const FALLBACK_ZONES: Partial<Record<MetroId, ZoneData[]>> = {
  johannesburg: [
    { zone_id: 'johannesburg-north',   name: 'City of Johannesburg North',   population: 1_127_000, daily_intake_ml: 394.5, daily_usage_ml: 335.3, daily_wastage_ml: 59.2,  wastage_percentage: 15.0, has_active_leaks: false, leak_count: 0, priority_score: 12.0, bounds_geojson: {} },
    { zone_id: 'johannesburg-south',   name: 'City of Johannesburg South',   population: 1_086_000, daily_intake_ml: 380.2, daily_usage_ml: 304.2, daily_wastage_ml: 76.0,  wastage_percentage: 20.0, has_active_leaks: false, leak_count: 0, priority_score: 16.0, bounds_geojson: {} },
    { zone_id: 'johannesburg-east',    name: 'City of Johannesburg East',    population: 1_190_000, daily_intake_ml: 416.4, daily_usage_ml: 291.5, daily_wastage_ml: 124.9, wastage_percentage: 30.0, has_active_leaks: true,  leak_count: 3, priority_score: 45.0, bounds_geojson: {} },
    { zone_id: 'johannesburg-west',    name: 'City of Johannesburg West',    population: 1_045_000, daily_intake_ml: 365.9, daily_usage_ml: 300.4, daily_wastage_ml: 65.5,  wastage_percentage: 17.9, has_active_leaks: false, leak_count: 0, priority_score: 14.3, bounds_geojson: {} },
    { zone_id: 'johannesburg-central', name: 'City of Johannesburg Central', population: 1_187_000, daily_intake_ml: 415.3, daily_usage_ml: 311.5, daily_wastage_ml: 103.8, wastage_percentage: 25.0, has_active_leaks: true,  leak_count: 2, priority_score: 37.5, bounds_geojson: {} },
  ],
  cape_town: [
    { zone_id: 'cape_town-northern', name: 'City of Cape Town Northern', population: 924_000, daily_intake_ml: 340.4, daily_usage_ml: 272.3, daily_wastage_ml: 68.1,  wastage_percentage: 20.0, has_active_leaks: false, leak_count: 0, priority_score: 16.0, bounds_geojson: {} },
    { zone_id: 'cape_town-southern', name: 'City of Cape Town Southern', population: 892_000, daily_intake_ml: 328.6, daily_usage_ml: 270.3, daily_wastage_ml: 58.3,  wastage_percentage: 17.7, has_active_leaks: false, leak_count: 0, priority_score: 14.2, bounds_geojson: {} },
    { zone_id: 'cape_town-eastern',  name: 'City of Cape Town Eastern',  population: 985_000, daily_intake_ml: 362.8, daily_usage_ml: 253.9, daily_wastage_ml: 108.9, wastage_percentage: 30.0, has_active_leaks: true,  leak_count: 2, priority_score: 45.0, bounds_geojson: {} },
    { zone_id: 'cape_town-western',  name: 'City of Cape Town Western',  population: 876_000, daily_intake_ml: 322.7, daily_usage_ml: 264.6, daily_wastage_ml: 58.1,  wastage_percentage: 18.0, has_active_leaks: false, leak_count: 0, priority_score: 14.4, bounds_geojson: {} },
    { zone_id: 'cape_town-cbd',      name: 'City of Cape Town CBD',      population: 941_000, daily_intake_ml: 346.8, daily_usage_ml: 260.1, daily_wastage_ml: 86.7,  wastage_percentage: 25.0, has_active_leaks: true,  leak_count: 1, priority_score: 37.5, bounds_geojson: {} },
  ],
  ekurhuleni: [
    { zone_id: 'ekurhuleni-north', name: 'Ekurhuleni North', population: 954_000, daily_intake_ml: 351.8, daily_usage_ml: 281.4, daily_wastage_ml: 70.4,  wastage_percentage: 20.0, has_active_leaks: false, leak_count: 0, priority_score: 16.0, bounds_geojson: {} },
    { zone_id: 'ekurhuleni-south', name: 'Ekurhuleni South', population: 983_000, daily_intake_ml: 362.3, daily_usage_ml: 253.6, daily_wastage_ml: 108.7, wastage_percentage: 30.0, has_active_leaks: true,  leak_count: 2, priority_score: 45.0, bounds_geojson: {} },
    { zone_id: 'ekurhuleni-east',  name: 'Ekurhuleni East',  population: 915_000, daily_intake_ml: 337.3, daily_usage_ml: 276.7, daily_wastage_ml: 60.6,  wastage_percentage: 18.0, has_active_leaks: false, leak_count: 0, priority_score: 14.4, bounds_geojson: {} },
    { zone_id: 'ekurhuleni-west',  name: 'Ekurhuleni West',  population: 965_000, daily_intake_ml: 355.7, daily_usage_ml: 266.8, daily_wastage_ml: 88.9,  wastage_percentage: 25.0, has_active_leaks: true,  leak_count: 1, priority_score: 37.5, bounds_geojson: {} },
  ],
  ethekwini: [
    { zone_id: 'ethekwini-north',   name: 'eThekwini North',   population: 999_000,  daily_intake_ml: 368.1, daily_usage_ml: 294.5, daily_wastage_ml: 73.6,  wastage_percentage: 20.0, has_active_leaks: false, leak_count: 0, priority_score: 16.0, bounds_geojson: {} },
    { zone_id: 'ethekwini-south',   name: 'eThekwini South',   population: 1_087_000, daily_intake_ml: 400.5, daily_usage_ml: 280.4, daily_wastage_ml: 120.1, wastage_percentage: 30.0, has_active_leaks: true,  leak_count: 3, priority_score: 45.0, bounds_geojson: {} },
    { zone_id: 'ethekwini-central', name: 'eThekwini Central', population: 952_000,  daily_intake_ml: 350.7, daily_usage_ml: 287.6, daily_wastage_ml: 63.1,  wastage_percentage: 18.0, has_active_leaks: false, leak_count: 0, priority_score: 14.4, bounds_geojson: {} },
    { zone_id: 'ethekwini-coastal', name: 'eThekwini Coastal', population: 957_000,  daily_intake_ml: 352.6, daily_usage_ml: 264.5, daily_wastage_ml: 88.1,  wastage_percentage: 25.0, has_active_leaks: true,  leak_count: 2, priority_score: 37.5, bounds_geojson: {} },
  ],
  tshwane: [
    { zone_id: 'tshwane-north',   name: 'City of Tshwane North',   population: 655_000, daily_intake_ml: 241.4, daily_usage_ml: 193.1, daily_wastage_ml: 48.3, wastage_percentage: 20.0, has_active_leaks: false, leak_count: 0, priority_score: 16.0, bounds_geojson: {} },
    { zone_id: 'tshwane-south',   name: 'City of Tshwane South',   population: 682_000, daily_intake_ml: 251.3, daily_usage_ml: 175.9, daily_wastage_ml: 75.4, wastage_percentage: 30.0, has_active_leaks: true,  leak_count: 2, priority_score: 45.0, bounds_geojson: {} },
    { zone_id: 'tshwane-east',    name: 'City of Tshwane East',    population: 643_000, daily_intake_ml: 236.9, daily_usage_ml: 194.3, daily_wastage_ml: 42.6, wastage_percentage: 18.0, has_active_leaks: false, leak_count: 0, priority_score: 14.4, bounds_geojson: {} },
    { zone_id: 'tshwane-west',    name: 'City of Tshwane West',    population: 671_000, daily_intake_ml: 247.3, daily_usage_ml: 185.5, daily_wastage_ml: 61.8, wastage_percentage: 25.0, has_active_leaks: true,  leak_count: 1, priority_score: 37.5, bounds_geojson: {} },
    { zone_id: 'tshwane-central', name: 'City of Tshwane Central', population: 624_000, daily_intake_ml: 230.0, daily_usage_ml: 195.5, daily_wastage_ml: 34.5, wastage_percentage: 15.0, has_active_leaks: false, leak_count: 0, priority_score: 12.0, bounds_geojson: {} },
  ],
  nelson_mandela_bay: [
    { zone_id: 'nelson_mandela_bay-north',   name: 'Nelson Mandela Bay North',   population: 431_000, daily_intake_ml: 158.8, daily_usage_ml: 127.0, daily_wastage_ml: 31.8, wastage_percentage: 20.0, has_active_leaks: false, leak_count: 0, priority_score: 16.0, bounds_geojson: {} },
    { zone_id: 'nelson_mandela_bay-south',   name: 'Nelson Mandela Bay South',   population: 452_000, daily_intake_ml: 166.5, daily_usage_ml: 116.6, daily_wastage_ml: 49.9, wastage_percentage: 30.0, has_active_leaks: true,  leak_count: 2, priority_score: 45.0, bounds_geojson: {} },
    { zone_id: 'nelson_mandela_bay-central', name: 'Nelson Mandela Bay Central', population: 410_000, daily_intake_ml: 151.1, daily_usage_ml: 123.9, daily_wastage_ml: 27.2, wastage_percentage: 18.0, has_active_leaks: false, leak_count: 0, priority_score: 14.4, bounds_geojson: {} },
  ],
  buffalo_city: [
    { zone_id: 'buffalo_city-north', name: 'Buffalo City North', population: 416_000, daily_intake_ml: 153.4, daily_usage_ml: 122.7, daily_wastage_ml: 30.7, wastage_percentage: 20.0, has_active_leaks: false, leak_count: 0, priority_score: 16.0, bounds_geojson: {} },
    { zone_id: 'buffalo_city-south', name: 'Buffalo City South', population: 416_000, daily_intake_ml: 153.4, daily_usage_ml: 107.4, daily_wastage_ml: 46.0, wastage_percentage: 30.0, has_active_leaks: true,  leak_count: 2, priority_score: 45.0, bounds_geojson: {} },
  ],
  mangaung: [
    { zone_id: 'mangaung-north', name: 'Mangaung North', population: 392_000, daily_intake_ml: 144.3, daily_usage_ml: 115.4, daily_wastage_ml: 28.9, wastage_percentage: 20.0, has_active_leaks: false, leak_count: 0, priority_score: 16.0, bounds_geojson: {} },
    { zone_id: 'mangaung-south', name: 'Mangaung South', population: 391_000, daily_intake_ml: 144.0, daily_usage_ml: 100.8, daily_wastage_ml: 43.2, wastage_percentage: 30.0, has_active_leaks: true,  leak_count: 2, priority_score: 45.0, bounds_geojson: {} },
  ],
};

function severityColour(zone: ZoneData): string {
  if (zone.has_active_leaks && zone.wastage_percentage > 30) return '#dc2626';
  if (zone.has_active_leaks || zone.wastage_percentage > 25) return '#ea580c';
  if (zone.wastage_percentage > 20) return '#f59e0b';
  return '#16a34a';
}

function severityLabel(zone: ZoneData): string {
  if (zone.has_active_leaks && zone.wastage_percentage > 30) return 'CRITICAL';
  if (zone.has_active_leaks || zone.wastage_percentage > 25) return 'HIGH';
  if (zone.wastage_percentage > 20) return 'MEDIUM';
  return 'LOW';
}

const MetroZoneMap: React.FC<MetroZoneMapProps> = ({ metro, onZonesUpdate }) => {
  const [zones, setZones] = useState<ZoneData[]>([]);
  const [selectedZone, setSelectedZone] = useState<ZoneData | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  const fetchZones = useCallback(async () => {
    setLoading(true);
    setUsingFallback(false);
    try {
      const data = await apiService.getMetroZones(metro.id);
      setZones(data);
      onZonesUpdate?.(data);
    } catch (error) {
      console.warn('Falling back to demo zone data', error);
      const fallback = FALLBACK_ZONES[metro.id] ?? [];
      setZones(fallback);
      setUsingFallback(true);
      onZonesUpdate?.(fallback);
    } finally {
      setLoading(false);
    }
  }, [metro.id, onZonesUpdate]);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  const sortedZones = [...zones].sort((a, b) => b.priority_score - a.priority_score);
  const problemZones = sortedZones.filter(z => z.has_active_leaks || z.wastage_percentage > 25);

  if (loading) {
    return (
      <div className="metro-zone-map loading">
        <p>Loading zone data…</p>
      </div>
    );
  }

  return (
    <div className="metro-zone-map">
      <div className="zone-map-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h3>{metro.name} &mdash; problem-area analysis</h3>
          {usingFallback && (
            <span style={{
              padding: '0.25rem 0.75rem',
              background: '#dbeafe',
              color: '#1e40af',
              borderRadius: 6,
              fontSize: '0.75rem',
              fontWeight: 600,
            }}>
              DEMO DATA
            </span>
          )}
        </div>
        <div className="zone-stats-mini">
          <span className="stat-item"><strong>{zones.length}</strong> zones</span>
          <span className="stat-item critical">
            <AlertTriangle size={16} />
            <strong>{problemZones.length}</strong> problem areas
          </span>
        </div>
      </div>

      {usingFallback && (
        <div style={{
          margin: '1rem 1.5rem',
          padding: '1rem',
          background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
          borderLeft: '4px solid #3b82f6',
          borderRadius: 8,
          fontSize: '0.9rem',
          color: '#1e40af',
        }}>
          <strong>What this section shows</strong>
          <p style={{ margin: '0.5rem 0 0 0', color: '#1f2937' }}>
            Zone-level distribution analysis showing geographic areas within {metro.name}.
            Each coloured zone represents a district&rsquo;s wastage levels and active leak status.
            Click zones to view population, daily intake/usage, wastage percentages, and recommended
            interventions. Live data is currently unavailable, so demo numbers are shown.
          </p>
        </div>
      )}

      <div className="zone-content">
        <div className="zone-grid-visual">
          {sortedZones.map(zone => (
            <div
              key={zone.zone_id}
              className={`zone-block ${selectedZone?.zone_id === zone.zone_id ? 'selected' : ''}`}
              style={{
                backgroundColor: severityColour(zone),
                opacity: selectedZone && selectedZone.zone_id !== zone.zone_id ? 0.4 : 1,
              }}
              onClick={() => setSelectedZone(zone)}
              onMouseEnter={() => setSelectedZone(zone)}
            >
              <div className="zone-block-label">
                {zone.name.split(' ').pop()}
              </div>
              {zone.has_active_leaks && (
                <div className="zone-alert-icon">
                  <AlertTriangle size={18} />
                </div>
              )}
            </div>
          ))}
        </div>

        {selectedZone && (
          <div className="zone-details-panel">
            <div className="zone-detail-header">
              <h4>{selectedZone.name}</h4>
              <span className="zone-severity-badge" style={{ backgroundColor: severityColour(selectedZone) }}>
                {severityLabel(selectedZone)}
              </span>
            </div>

            <div className="zone-metrics">
              <div className="zone-metric">
                <span className="metric-label">Population:</span>
                <span className="metric-value">{(selectedZone.population / 1000).toFixed(0)}k</span>
              </div>
              <div className="zone-metric">
                <span className="metric-label">Daily intake:</span>
                <span className="metric-value">{selectedZone.daily_intake_ml.toFixed(1)} ML</span>
              </div>
              <div className="zone-metric">
                <span className="metric-label">Daily usage:</span>
                <span className="metric-value">{selectedZone.daily_usage_ml.toFixed(1)} ML</span>
              </div>
              <div className="zone-metric">
                <span className="metric-label">Wastage:</span>
                <span className="metric-value wastage">
                  {selectedZone.daily_wastage_ml.toFixed(1)} ML
                  <span className="percentage">({selectedZone.wastage_percentage.toFixed(1)}%)</span>
                </span>
              </div>
            </div>

            {selectedZone.has_active_leaks && (
              <div className="zone-leak-alert">
                <AlertTriangle size={20} />
                <div>
                  <strong>{selectedZone.leak_count} active leak{selectedZone.leak_count > 1 ? 's' : ''} detected</strong>
                  <p>Priority score: {selectedZone.priority_score.toFixed(1)} / 100</p>
                </div>
              </div>
            )}

            <div className="zone-recommendations">
              <h5>Recommended actions</h5>
              <ul>
                {selectedZone.has_active_leaks && <li>Deploy leak-detection team immediately</li>}
                {selectedZone.wastage_percentage > 25 && <li>Conduct pressure-management audit</li>}
                {selectedZone.priority_score > 40 && <li>Escalate to emergency response team</li>}
                <li>Install additional flow sensors</li>
                <li>Schedule infrastructure inspection</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="zone-priority-list">
        <h4>Priority problem areas (ranked by urgency)</h4>
        {problemZones.length === 0 ? (
          <div className="no-problems">
            <CheckCircle size={24} color="#16a34a" />
            <p>No critical problem areas detected in this metro.</p>
          </div>
        ) : (
          <div className="priority-zones-list">
            {problemZones.slice(0, 5).map((zone, index) => (
              <div
                key={zone.zone_id}
                className="priority-zone-item"
                onClick={() => setSelectedZone(zone)}
              >
                <div className="priority-rank">{index + 1}</div>
                <div className="priority-zone-info">
                  <strong>{zone.name}</strong>
                  <div className="priority-zone-metrics">
                    <span className="wastage-badge">{zone.wastage_percentage.toFixed(1)}% wastage</span>
                    {zone.has_active_leaks && (
                      <span className="leak-badge">{zone.leak_count} leak{zone.leak_count > 1 ? 's' : ''}</span>
                    )}
                    <span className="loss-value">~R{(zone.daily_wastage_ml * 12000).toLocaleString()}/day loss</span>
                  </div>
                </div>
                <div className="priority-arrow">
                  <TrendingUp size={20} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MetroZoneMap;
