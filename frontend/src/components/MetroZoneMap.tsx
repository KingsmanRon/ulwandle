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

const MetroZoneMap: React.FC<MetroZoneMapProps> = ({ metro }) => {
  const [zones, setZones] = useState<ZoneData[]>([]);
  const [selectedZone, setSelectedZone] = useState<ZoneData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchZones();
  }, [metro.id]);

  const fetchZones = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/api/v1/metros/${metro.id}/zones`);
      const data = await response.json();
      setZones(data);
    } catch (error) {
      console.error('Error fetching zones:', error);
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
        <h3>📍 {metro.name} - Problem Area Analysis</h3>
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
