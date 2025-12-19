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

  // Metro positions as percentages - responsive at any screen size
  // Measured directly from Map_of_the_metropolitan_municipalities image
  const metroPositions = {
    cpt:      { x: "16.0%", y: "91.0%", name: "Cape Town" },      
    nelson:   { x: "53.0%", y: "89.5%", name: "Nelson Mandela Bay" },
    buffalo:  { x: "67.0%", y: "83.5%", name: "Buffalo City" },   
    ethek:    { x: "84.0%", y: "61.5%", name: "eThekwini" },     
    manguang: { x: "60.0%", y: "54.5%", name: "Mangaung" },     
    jhb:      { x: "88.5%", y: "33.0%", name: "Johannesburg" },  
    ekhur:    { x: "94.5%", y: "33.0%", name: "Ekurhuleni" },     
    tshwane:  { x: "98.0%", y: "26.5%", name: "Tshwane" },        
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

          return (
            <div
              key={metro.id}
              className={`metro-marker ${isSelected(metro) ? 'selected' : ''}`}
              style={{
                left: pos.x,
                top: pos.y,
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
