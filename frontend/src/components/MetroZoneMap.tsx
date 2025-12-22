import React, { useState, useEffect } from 'react';
import { Metro } from '../constants/saMetros';
import { AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';
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
}

// Fallback demo data for zone-based analysis
const FALLBACK_ZONES: Record<string, ZoneData[]> = {
  jhb: [
    { zone_id: 'jhb-north', name: 'Johannesburg North', population: 650000, daily_intake_ml: 145.2, daily_usage_ml: 108.9, daily_wastage_ml: 36.3, wastage_percentage: 25.0, has_active_leaks: true, leak_count: 2, priority_score: 37.5, bounds_geojson: {} },
    { zone_id: 'jhb-south', name: 'Johannesburg South', population: 580000, daily_intake_ml: 129.6, daily_usage_ml: 103.7, daily_wastage_ml: 25.9, wastage_percentage: 20.0, has_active_leaks: false, leak_count: 0, priority_score: 16.0, bounds_geojson: {} },
    { zone_id: 'jhb-east', name: 'Johannesburg East', population: 720000, daily_intake_ml: 158.4, daily_usage_ml: 110.9, daily_wastage_ml: 47.5, wastage_percentage: 30.0, has_active_leaks: true, leak_count: 3, priority_score: 45.0, bounds_geojson: {} },
    { zone_id: 'jhb-west', name: 'Johannesburg West', population: 490000, daily_intake_ml: 107.8, daily_usage_ml: 88.4, daily_wastage_ml: 19.4, wastage_percentage: 18.0, has_active_leaks: false, leak_count: 0, priority_score: 14.4, bounds_geojson: {} },
    { zone_id: 'jhb-central', name: 'Johannesburg Central', population: 380000, daily_intake_ml: 83.6, daily_usage_ml: 62.7, daily_wastage_ml: 20.9, wastage_percentage: 25.0, has_active_leaks: true, leak_count: 1, priority_score: 37.5, bounds_geojson: {} },
    { zone_id: 'jhb-cbd', name: 'Johannesburg CBD', population: 220000, daily_intake_ml: 48.4, daily_usage_ml: 38.7, daily_wastage_ml: 9.7, wastage_percentage: 20.0, has_active_leaks: false, leak_count: 0, priority_score: 16.0, bounds_geojson: {} },
  ],
  cpt: [
    { zone_id: 'cpt-northern', name: 'Cape Town Northern Suburbs', population: 520000, daily_intake_ml: 98.8, daily_usage_ml: 74.1, daily_wastage_ml: 24.7, wastage_percentage: 25.0, has_active_leaks: true, leak_count: 2, priority_score: 37.5, bounds_geojson: {} },
    { zone_id: 'cpt-southern', name: 'Cape Town Southern Suburbs', population: 480000, daily_intake_ml: 91.2, daily_usage_ml: 75.0, daily_wastage_ml: 16.2, wastage_percentage: 17.8, has_active_leaks: false, leak_count: 0, priority_score: 14.2, bounds_geojson: {} },
    { zone_id: 'cpt-cbd', name: 'Cape Town CBD', population: 180000, daily_intake_ml: 34.2, daily_usage_ml: 27.4, daily_wastage_ml: 6.8, wastage_percentage: 20.0, has_active_leaks: false, leak_count: 0, priority_score: 16.0, bounds_geojson: {} },
    { zone_id: 'cpt-atlantic', name: 'Cape Town Atlantic Seaboard', population: 290000, daily_intake_ml: 55.1, daily_usage_ml: 38.6, daily_wastage_ml: 16.5, wastage_percentage: 30.0, has_active_leaks: true, leak_count: 2, priority_score: 45.0, bounds_geojson: {} },
    { zone_id: 'cpt-helderberg', name: 'Cape Town Helderberg', population: 350000, daily_intake_ml: 66.5, daily_usage_ml: 53.2, daily_wastage_ml: 13.3, wastage_percentage: 20.0, has_active_leaks: false, leak_count: 0, priority_score: 16.0, bounds_geojson: {} },
  ],
  eth: [
    { zone_id: 'eth-ward1', name: 'eThekwini Ward 1-15', population: 480000, daily_intake_ml: 110.4, daily_usage_ml: 82.8, daily_wastage_ml: 27.6, wastage_percentage: 25.0, has_active_leaks: true, leak_count: 3, priority_score: 37.5, bounds_geojson: {} },
    { zone_id: 'eth-ward16', name: 'eThekwini Ward 16-30', population: 520000, daily_intake_ml: 119.6, daily_usage_ml: 95.7, daily_wastage_ml: 23.9, wastage_percentage: 20.0, has_active_leaks: false, leak_count: 0, priority_score: 16.0, bounds_geojson: {} },
    { zone_id: 'eth-ward31', name: 'eThekwini Ward 31-45', population: 590000, daily_intake_ml: 135.7, daily_usage_ml: 95.0, daily_wastage_ml: 40.7, wastage_percentage: 30.0, has_active_leaks: true, leak_count: 2, priority_score: 45.0, bounds_geojson: {} },
    { zone_id: 'eth-ward46', name: 'eThekwini Ward 46-60', population: 450000, daily_intake_ml: 103.5, daily_usage_ml: 84.9, daily_wastage_ml: 18.6, wastage_percentage: 18.0, has_active_leaks: false, leak_count: 0, priority_score: 14.4, bounds_geojson: {} },
  ],
  tsh: [
    { zone_id: 'tsh-zone-a', name: 'Tshwane Zone A', population: 420000, daily_intake_ml: 95.2, daily_usage_ml: 71.4, daily_wastage_ml: 23.8, wastage_percentage: 25.0, has_active_leaks: true, leak_count: 2, priority_score: 37.5, bounds_geojson: {} },
    { zone_id: 'tsh-zone-b', name: 'Tshwane Zone B', population: 380000, daily_intake_ml: 86.1, daily_usage_ml: 68.9, daily_wastage_ml: 17.2, wastage_percentage: 20.0, has_active_leaks: false, leak_count: 0, priority_score: 16.0, bounds_geojson: {} },
    { zone_id: 'tsh-zone-c', name: 'Tshwane Zone C', population: 510000, daily_intake_ml: 115.6, daily_usage_ml: 80.9, daily_wastage_ml: 34.7, wastage_percentage: 30.0, has_active_leaks: true, leak_count: 3, priority_score: 45.0, bounds_geojson: {} },
    { zone_id: 'tsh-zone-d', name: 'Tshwane Zone D', population: 340000, daily_intake_ml: 77.0, daily_usage_ml: 63.1, daily_wastage_ml: 13.9, wastage_percentage: 18.0, has_active_leaks: false, leak_count: 0, priority_score: 14.4, bounds_geojson: {} },
  ],
  nmb: [
    { zone_id: 'nmb-northern', name: 'Nelson Mandela Bay Northern Areas', population: 290000, daily_intake_ml: 52.2, daily_usage_ml: 39.2, daily_wastage_ml: 13.0, wastage_percentage: 25.0, has_active_leaks: true, leak_count: 1, priority_score: 37.5, bounds_geojson: {} },
    { zone_id: 'nmb-central', name: 'Nelson Mandela Bay Central', population: 320000, daily_intake_ml: 57.6, daily_usage_ml: 46.1, daily_wastage_ml: 11.5, wastage_percentage: 20.0, has_active_leaks: false, leak_count: 0, priority_score: 16.0, bounds_geojson: {} },
    { zone_id: 'nmb-southern', name: 'Nelson Mandela Bay Southern Areas', population: 380000, daily_intake_ml: 68.4, daily_usage_ml: 47.9, daily_wastage_ml: 20.5, wastage_percentage: 30.0, has_active_leaks: true, leak_count: 2, priority_score: 45.0, bounds_geojson: {} },
  ],
  eku: [
    { zone_id: 'eku-mdantsane', name: 'Ekurhuleni Mdantsane', population: 210000, daily_intake_ml: 37.8, daily_usage_ml: 28.4, daily_wastage_ml: 9.4, wastage_percentage: 25.0, has_active_leaks: true, leak_count: 2, priority_score: 37.5, bounds_geojson: {} },
    { zone_id: 'eku-king', name: 'Ekurhuleni King Williams Town', population: 180000, daily_intake_ml: 32.4, daily_usage_ml: 25.9, daily_wastage_ml: 6.5, wastage_percentage: 20.0, has_active_leaks: false, leak_count: 0, priority_score: 16.0, bounds_geojson: {} },
    { zone_id: 'eku-east', name: 'Ekurhuleni East London', population: 240000, daily_intake_ml: 43.2, daily_usage_ml: 30.2, daily_wastage_ml: 13.0, wastage_percentage: 30.0, has_active_leaks: true, leak_count: 1, priority_score: 45.0, bounds_geojson: {} },
  ],
  man: [
    { zone_id: 'man-north', name: 'Mangaung North', population: 180000, daily_intake_ml: 32.4, daily_usage_ml: 24.3, daily_wastage_ml: 8.1, wastage_percentage: 25.0, has_active_leaks: true, leak_count: 1, priority_score: 37.5, bounds_geojson: {} },
    { zone_id: 'man-central', name: 'Mangaung Central', population: 220000, daily_intake_ml: 39.6, daily_usage_ml: 31.7, daily_wastage_ml: 7.9, wastage_percentage: 20.0, has_active_leaks: false, leak_count: 0, priority_score: 16.0, bounds_geojson: {} },
    { zone_id: 'man-south', name: 'Mangaung South', population: 190000, daily_intake_ml: 34.2, daily_usage_ml: 23.9, daily_wastage_ml: 10.3, wastage_percentage: 30.0, has_active_leaks: true, leak_count: 2, priority_score: 45.0, bounds_geojson: {} },
  ],
  bcm: [
    { zone_id: 'bcm-zone1', name: 'Buffalo City Zone 1', population: 170000, daily_intake_ml: 30.6, daily_usage_ml: 23.0, daily_wastage_ml: 7.6, wastage_percentage: 25.0, has_active_leaks: true, leak_count: 1, priority_score: 37.5, bounds_geojson: {} },
    { zone_id: 'bcm-zone2', name: 'Buffalo City Zone 2', population: 150000, daily_intake_ml: 27.0, daily_usage_ml: 21.6, daily_wastage_ml: 5.4, wastage_percentage: 20.0, has_active_leaks: false, leak_count: 0, priority_score: 16.0, bounds_geojson: {} },
    { zone_id: 'bcm-zone3', name: 'Buffalo City Zone 3', population: 210000, daily_intake_ml: 37.8, daily_usage_ml: 26.5, daily_wastage_ml: 11.3, wastage_percentage: 30.0, has_active_leaks: true, leak_count: 2, priority_score: 45.0, bounds_geojson: {} },
  ],
};

const MetroZoneMap: React.FC<MetroZoneMapProps> = ({ metro }) => {
  const [zones, setZones] = useState<ZoneData[]>([]);
  const [selectedZone, setSelectedZone] = useState<ZoneData | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    fetchZones();
  }, [metro.id]);

  const fetchZones = async () => {
    setLoading(true);
    setUsingFallback(false);
    try {
      const response = await fetch(`http://localhost:8000/api/v1/metros/${metro.id}/zones`);
      if (!response.ok) throw new Error('API not available');
      const data = await response.json();
      setZones(data);
    } catch (error) {
      console.log('Using fallback zone data (backend not running)');
      // Use fallback demo data
      const fallbackData = FALLBACK_ZONES[metro.id] || [];
      setZones(fallbackData);
      setUsingFallback(true);
    } finally {
      setLoading(false);
    }
  };

  const getZoneColor = (zone: ZoneData): string => {
    if (zone.has_active_leaks && zone.wastage_percentage > 30) {
      return '#dc2626';  // Critical red
    } else if (zone.has_active_leaks || zone.wastage_percentage > 25) {
      return '#ea580c';  // High orange
    } else if (zone.wastage_percentage > 20) {
      return '#f59e0b';  // Medium yellow
    } else {
      return '#16a34a';  // Low green
    }
  };

  const getSeverityLabel = (zone: ZoneData): string => {
    if (zone.has_active_leaks && zone.wastage_percentage > 30) {
      return 'CRITICAL';
    } else if (zone.has_active_leaks || zone.wastage_percentage > 25) {
      return 'HIGH';
    } else if (zone.wastage_percentage > 20) {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  };

  // Sort zones by priority (highest first)
  const sortedZones = [...zones].sort((a, b) => b.priority_score - a.priority_score);
  const problemZones = sortedZones.filter(z => z.has_active_leaks || z.wastage_percentage > 25);

  if (loading) {
    return (
      <div className="metro-zone-map loading">
        <p>Loading zone data...</p>
      </div>
    );
  }

  return (
    <div className="metro-zone-map">
      <div className="zone-map-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h3>📍 {metro.name} - Problem Area Analysis</h3>
          {usingFallback && (
            <span style={{
              padding: '0.25rem 0.75rem',
              background: '#dbeafe',
              color: '#1e40af',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: '600'
            }}>
              DEMO DATA
            </span>
          )}
        </div>
        <div className="zone-stats-mini">
          <span className="stat-item">
            <strong>{zones.length}</strong> Zones
          </span>
          <span className="stat-item critical">
            <AlertTriangle size={16} />
            <strong>{problemZones.length}</strong> Problem Areas
          </span>
        </div>
      </div>

      {usingFallback && (
        <div style={{
          margin: '1rem 1.5rem',
          padding: '1rem',
          background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
          borderLeft: '4px solid #3b82f6',
          borderRadius: '8px',
          fontSize: '0.9rem',
          color: '#1e40af'
        }}>
          <strong>📊 What This Section Shows:</strong>
          <p style={{ margin: '0.5rem 0 0 0', color: '#1f2937' }}>
            Zone-level water distribution analysis showing geographic areas within {metro.name}.
            Each colored zone represents a district's water wastage levels and active leak detection status.
            Click zones to view detailed metrics including population, daily intake/usage, wastage percentages,
            and recommended intervention actions. This data helps prioritize maintenance resources to areas with
            highest water loss.
          </p>
        </div>
      )}

      <div className="zone-content">
        {/* Simplified zone visualization */}
        <div className="zone-grid-visual">
          {sortedZones.map((zone, index) => (
            <div
              key={zone.zone_id}
              className={`zone-block ${selectedZone?.zone_id === zone.zone_id ? 'selected' : ''}`}
              style={{
                backgroundColor: getZoneColor(zone),
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

        {/* Zone details panel */}
        {selectedZone && (
          <div className="zone-details-panel">
            <div className="zone-detail-header">
              <h4>{selectedZone.name}</h4>
              <span
                className="zone-severity-badge"
                style={{ backgroundColor: getZoneColor(selectedZone) }}
              >
                {getSeverityLabel(selectedZone)}
              </span>
            </div>

            <div className="zone-metrics">
              <div className="zone-metric">
                <span className="metric-label">Population:</span>
                <span className="metric-value">{(selectedZone.population / 1000).toFixed(0)}k</span>
              </div>
              <div className="zone-metric">
                <span className="metric-label">Daily Intake:</span>
                <span className="metric-value">{selectedZone.daily_intake_ml.toFixed(1)} ML</span>
              </div>
              <div className="zone-metric">
                <span className="metric-label">Daily Usage:</span>
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
                  <strong>{selectedZone.leak_count} Active Leak{selectedZone.leak_count > 1 ? 's' : ''} Detected</strong>
                  <p>Priority Score: {selectedZone.priority_score.toFixed(1)} / 100</p>
                </div>
              </div>
            )}

            <div className="zone-recommendations">
              <h5>🎯 Recommended Actions:</h5>
              <ul>
                {selectedZone.has_active_leaks && (
                  <li>Deploy leak detection team immediately</li>
                )}
                {selectedZone.wastage_percentage > 25 && (
                  <li>Conduct pressure management audit</li>
                )}
                {selectedZone.priority_score > 40 && (
                  <li>Escalate to emergency response team</li>
                )}
                <li>Install additional flow sensors</li>
                <li>Schedule infrastructure inspection</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Priority list */}
      <div className="zone-priority-list">
        <h4>⚠️ Priority Problem Areas (Ranked by Urgency)</h4>
        {problemZones.length === 0 ? (
          <div className="no-problems">
            <CheckCircle size={24} color="#16a34a" />
            <p>No critical problem areas detected in this metro!</p>
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
                    <span className="loss-value">~R{(zone.daily_wastage_ml * 400).toLocaleString()}/day loss</span>
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
