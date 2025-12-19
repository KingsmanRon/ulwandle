import React, { useState } from 'react';
import { Metro, EIGHT_METROS } from '../constants/saMetros';
import './SouthAfricaMap.css';

interface SouthAfricaMapProps {
  selectedMetros: Metro[];
  onMetroClick: (metro: Metro) => void;
  metroStressLevels?: Map<string, { level: string; wastage: number }>;
}

const SouthAfricaMap: React.FC<SouthAfricaMapProps> = ({
  selectedMetros,
  onMetroClick,
  metroStressLevels
}) => {
  const [hoveredMetro, setHoveredMetro] = useState<Metro | null>(null);

  const isSelected = (metro: Metro) => {
    return selectedMetros.some(m => m.id === metro.id);
  };

  const getMetroColor = (metro: Metro): string => {
    if (!metroStressLevels) {
      return isSelected(metro) ? '#3b82f6' : '#94a3b8';
    }

    const stressData = metroStressLevels.get(metro.id);
    if (!stressData) {
      return isSelected(metro) ? '#3b82f6' : '#94a3b8';
    }

    // Color based on stress level
    const colors = {
      CRITICAL: '#dc2626',
      HIGH: '#ea580c',
      MEDIUM: '#f59e0b',
      LOW: '#16a34a',
    };

    const baseColor = colors[stressData.level as keyof typeof colors] || '#94a3b8';

    // If selected, make it brighter
    if (isSelected(metro)) {
      return baseColor;
    }

    // If not selected, make it more transparent
    return baseColor + '80';  // 50% opacity
  };

  const getMetroById = (id: string): Metro | undefined => {
    return EIGHT_METROS.find((m: Metro) => m.id === id);
  };

  const handleMetroClick = (metroId: string) => {
    const metro = getMetroById(metroId);
    if (metro) {
      onMetroClick(metro);
    }
  };

  const handleMetroHover = (metroId: string | null) => {
    if (metroId) {
      const metro = getMetroById(metroId);
      setHoveredMetro(metro || null);
    } else {
      setHoveredMetro(null);
    }
  };

  // Metro positions on the map (recalibrated from screenshot analysis)
  // Coordinates are for a 1000x800 viewBox - matching visible city labels
  const metroPositions = {
    cpt: { x: 165, y: 685, name: "Cape Town" },           // Bottom left - on "Cape Town" label
    nelson: { x: 710, y: 695, name: "Nelson Mandela Bay" }, // "Port Elizabeth" - bottom center-right
    buffalo: { x: 820, y: 660, name: "Buffalo City" },    // "East London" - right coast
    ethek: { x: 935, y: 500, name: "Durban" },            // "Durban" - right coast
    manguang: { x: 600, y: 460, name: "Bloemfontein" },   // Center - "Bloemfontein" label
    jhb: { x: 780, y: 255, name: "Johannesburg" },        // Upper center - "Johannesburg" label
    ekhur: { x: 900, y: 245, name: "Ekurhuleni" },        // East of JHB - near "Witbank"
    tshwane: { x: 840, y: 225, name: "Pretoria" },        // North of JHB - "Pretoria" label
  };

  return (
    <div className="south-africa-map-container">
      <div className="map-header">
        <h2>🗺️ South Africa - Metro Water Status</h2>
        <div className="map-legend">
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#16a34a' }}></div>
            <span>Low Stress</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#f59e0b' }}></div>
            <span>Medium</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#ea580c' }}></div>
            <span>High</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#dc2626' }}></div>
            <span>Critical</span>
          </div>
        </div>
      </div>

      <div style={{ position: 'relative', width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
        <svg
          className="sa-map-svg"
          viewBox="0 0 1000 800"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        >
          {/* Clean Background Map Image */}
          <image
            href="/sa-provinces.webp"
            x="0"
            y="0"
            width="1000"
            height="800"
            preserveAspectRatio="xMidYMid meet"
          />

        {/* Metro markers only - minimal circles */}
        {EIGHT_METROS.map((metro: Metro) => {
          const pos = metroPositions[metro.id as keyof typeof metroPositions];

          // Skip if position not defined for this metro
          if (!pos) {
            console.warn(`Position not defined for metro: ${metro.id}`);
            return null;
          }

          const radius = 10;

          return (
            <circle
              key={metro.id}
              cx={pos.x}
              cy={pos.y}
              r={radius}
              fill={getMetroColor(metro)}
              stroke="white"
              strokeWidth="2"
              onClick={() => handleMetroClick(metro.id)}
              style={{ cursor: 'pointer' }}
            />
          );
        })}
        </svg>
      </div>


      <div className="map-footer">
        <p>
          <strong>Selected:</strong> {selectedMetros.length} metro{selectedMetros.length !== 1 ? 's' : ''}
          {selectedMetros.length > 0 && (
            <span className="selected-metros-list">
              {' - '}
              {selectedMetros.map(m => m.name.replace('City of ', '')).join(', ')}
            </span>
          )}
        </p>
        <p className="map-hint">💡 Click metros to select/deselect. Hold Ctrl/Cmd for multi-select.</p>
      </div>
    </div>
  );
};

export default SouthAfricaMap;
