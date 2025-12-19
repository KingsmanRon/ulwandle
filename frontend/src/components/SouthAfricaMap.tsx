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

  // Metro positions on the map - positioned exactly on grey anchor points from map image
  // Coordinates for 1000x800 viewBox - matching the grey dots in sa-provinces - Copy.png
  const metroPositions = {
    cpt: { x: 155, y: 740, name: "Cape Town" },           // Southwest peninsula - grey anchor point
    nelson: { x: 518, y: 750, name: "Nelson Mandela Bay" }, // South coast - grey anchor point
    buffalo: { x: 635, y: 690, name: "Buffalo City" },    // Southeast coast - grey anchor point
    ethek: { x: 806, y: 505, name: "Durban" },            // East coast - grey anchor point
    manguang: { x: 500, y: 446, name: "Bloemfontein" },   // Central interior - grey anchor point
    jhb: { x: 566, y: 270, name: "Johannesburg" },        // Gauteng cluster - grey anchor point
    ekhur: { x: 643, y: 270, name: "Ekurhuleni" },        // East of JHB - grey anchor point
    tshwane: { x: 605, y: 185, name: "Pretoria" },        // North of JHB - grey anchor point
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

      {/* The Map Area with Absolute Positioned Markers */}
      <div className="map-wrapper">
        {/* The Background Map Image */}
        <img
          src="/Map_of_the_metropolitan_municipalities_of_South_Africa_(2016).svg.png"
          alt="South Africa Metropolitan Municipalities"
          className="sa-map-image"
        />

        {/* Metro Markers - Positioned Absolutely */}
        {EIGHT_METROS.map((metro: Metro) => {
          const pos = metroPositions[metro.id as keyof typeof metroPositions];

          // Skip if position not defined for this metro
          if (!pos) {
            console.warn(`Position not defined for metro: ${metro.id}`);
            return null;
          }

          // Convert coordinates to percentages for responsive positioning
          // Based on 1000x800 coordinate system
          const leftPercent = (pos.x / 1000) * 100;
          const topPercent = (pos.y / 800) * 100;

          return (
            <div
              key={metro.id}
              className={`metro-marker ${isSelected(metro) ? 'selected' : ''}`}
              style={{
                left: `${leftPercent}%`,
                top: `${topPercent}%`,
                backgroundColor: getMetroColor(metro),
              }}
              onClick={() => handleMetroClick(metro.id)}
              onMouseEnter={() => setHoveredMetro(metro)}
              onMouseLeave={() => setHoveredMetro(null)}
              title={pos.name}
            />
          );
        })}

        {/* Tooltip for Hovered Metro */}
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
