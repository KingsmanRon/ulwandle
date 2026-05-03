import React, { useState } from 'react';
import { Metro, METROS, MetroId } from '../constants/metros';
import './SouthAfricaMap.css';

interface SouthAfricaMapProps {
  selectedMetros: Metro[];
  onMetroClick: (metro: Metro) => void;
  metroStressLevels?: Map<string, { level: string; wastage: number }>;
}

// Marker positions as percentages of the background map dimensions —
// measured directly from
// /Map_of_the_metropolitan_municipalities_of_South_Africa_(2016).svg.png
const METRO_POSITIONS: Record<MetroId, { x: string; y: string }> = {
  cape_town:          { x: '16.0%', y: '91.0%' },
  nelson_mandela_bay: { x: '53.0%', y: '89.5%' },
  buffalo_city:       { x: '67.0%', y: '83.5%' },
  ethekwini:          { x: '84.0%', y: '61.5%' },
  mangaung:           { x: '60.0%', y: '54.5%' },
  johannesburg:       { x: '68.5%', y: '33.0%' },
  ekurhuleni:         { x: '71.5%', y: '33.0%' },
  tshwane:            { x: '70.8%', y: '28.5%' },
};

const STRESS_COLOURS: Record<string, string> = {
  CRITICAL: '#dc2626',
  HIGH: '#ea580c',
  MEDIUM: '#f59e0b',
  LOW: '#16a34a',
};

const SouthAfricaMap: React.FC<SouthAfricaMapProps> = ({
  selectedMetros,
  onMetroClick,
  metroStressLevels,
}) => {
  const [hoveredMetro, setHoveredMetro] = useState<Metro | null>(null);

  const isSelected = (metro: Metro) => selectedMetros.some(m => m.id === metro.id);

  const colourFor = (metro: Metro): string => {
    if (isSelected(metro)) return '#16a34a';
    const stress = metroStressLevels?.get(metro.id);
    if (!stress) return '#94a3b8';
    return (STRESS_COLOURS[stress.level] || '#94a3b8') + '80';
  };

  return (
    <div className="south-africa-map-container">
      <div className="map-header">
        <h2>South Africa &mdash; Metro water status</h2>
        <div className="map-legend">
          <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#16a34a' }} /><span>Low stress</span></div>
          <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#f59e0b' }} /><span>Medium</span></div>
          <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#ea580c' }} /><span>High</span></div>
          <div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#dc2626' }} /><span>Critical</span></div>
        </div>
      </div>

      <div className="map-wrapper">
        <img
          src={`${process.env.PUBLIC_URL}/Map_of_the_metropolitan_municipalities_of_South_Africa_(2016).svg.png`}
          alt="South Africa metropolitan municipalities"
          className="sa-map-image"
        />

        {METROS.map(metro => {
          const pos = METRO_POSITIONS[metro.id];
          if (!pos) return null;
          return (
            <button
              key={metro.id}
              type="button"
              aria-label={`Select ${metro.name}`}
              className={`metro-marker ${isSelected(metro) ? 'selected' : ''}`}
              style={{ left: pos.x, top: pos.y, backgroundColor: colourFor(metro) }}
              onClick={() => onMetroClick(metro)}
              onMouseEnter={() => setHoveredMetro(metro)}
              onMouseLeave={() => setHoveredMetro(null)}
              title={metro.shortName}
            />
          );
        })}

        {hoveredMetro && (
          <div className="map-tooltip">
            <h4>{hoveredMetro.name}</h4>
            <p>
              <strong>Status:</strong>{' '}
              {metroStressLevels?.get(hoveredMetro.id)?.level || 'Unknown'}
            </p>
            {metroStressLevels?.get(hoveredMetro.id) && (
              <p>
                <strong>Wastage:</strong>{' '}
                {metroStressLevels.get(hoveredMetro.id)!.wastage}%
              </p>
            )}
          </div>
        )}
      </div>

      <div className="map-footer">
        <p>
          <strong>Selected:</strong>{' '}
          {selectedMetros.length} metro{selectedMetros.length !== 1 ? 's' : ''}
          {selectedMetros.length > 0 && (
            <span className="selected-metros-list">
              {' — '}
              {selectedMetros.map(m => m.shortName).join(', ')}
            </span>
          )}
        </p>
        <p className="map-hint">Click metros to select / deselect.</p>
      </div>
    </div>
  );
};

export default SouthAfricaMap;
