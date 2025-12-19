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

  // Metro positions on the map (based on approximate geographic locations)
  // Coordinates are for a 1000x800 viewBox
  const metroPositions = {
    cpt: { x: 180, y: 700, name: "Cape Town" },           // Southwest coast
    nelson: { x: 550, y: 750, name: "Nelson Mandela Bay" }, // Southeast coast
    buffalo: { x: 640, y: 720, name: "Buffalo City" },    // East coast (East London)
    ethek: { x: 800, y: 620, name: "Durban" },            // East coast (KZN)
    manguang: { x: 500, y: 580, name: "Bloemfontein" },   // Central (Free State)
    jhb: { x: 650, y: 480, name: "Johannesburg" },        // Northeast (Gauteng)
    ekhur: { x: 690, y: 485, name: "Ekurhuleni" },        // East of Jhb (Gauteng)
    tshwane: { x: 640, y: 460, name: "Pretoria" },        // North of Jhb (Gauteng)
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
        {/* Background Map Image */}
        <svg
          className="sa-map-svg"
          viewBox="0 0 1000 800"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        >
          {/* Simplified South Africa Map Background - User can replace with actual image */}
          <rect width="1000" height="800" fill="#e0f2fe" />

          {/* Simplified SA Outline for now - shows general shape */}
          <path
            d="M 100 650 L 120 600 L 150 550 L 200 500 L 270 460 L 350 440 L 440 430
               L 530 435 L 620 450 L 700 480 L 770 520 L 830 570 L 870 630 L 890 690
               L 880 730 L 850 760 L 800 780 L 740 790 L 670 795 L 590 790 L 500 775
               L 400 750 L 300 715 L 200 675 L 130 660 L 100 650 Z"
            fill="#fef3c7"
            stroke="#92400e"
            strokeWidth="2"
            opacity="0.7"
          />

          {/* Note: Province boundaries from reference map */}
          <text x="500" y="50" textAnchor="middle" fill="#6b7280" fontSize="18" fontWeight="600">
            South Africa - Metro Water Status Map
          </text>
          <text x="500" y="75" textAnchor="middle" fill="#9ca3af" fontSize="12">
            (Map shows approximate locations - overlay on actual geographic map)
          </text>

        {/* Metro markers */}
        {EIGHT_METROS.map((metro: Metro) => {
          const pos = metroPositions[metro.id as keyof typeof metroPositions];

          // Skip if position not defined for this metro
          if (!pos) {
            console.warn(`Position not defined for metro: ${metro.id}`);
            return null;
          }

          const radius = isSelected(metro) ? 24 : 18;

          return (
            <g key={metro.id}>
              {/* Glow effect for selected metros */}
              {isSelected(metro) && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={radius + 8}
                  fill={getMetroColor(metro)}
                  opacity="0.2"
                  className="metro-glow"
                />
              )}

              {/* Metro circle */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={radius}
                fill={getMetroColor(metro)}
                stroke={isSelected(metro) ? '#1e40af' : 'white'}
                strokeWidth={isSelected(metro) ? '4' : '3'}
                className={`metro-marker ${isSelected(metro) ? 'selected' : ''} ${hoveredMetro?.id === metro.id ? 'hovered' : ''}`}
                onClick={() => handleMetroClick(metro.id)}
                onMouseEnter={() => handleMetroHover(metro.id)}
                onMouseLeave={() => handleMetroHover(null)}
                style={{ cursor: 'pointer' }}
              />

              {/* Metro label */}
              <text
                x={pos.x}
                y={pos.y + radius + 18}
                className="metro-label"
                textAnchor="middle"
                fontSize="12"
                fontWeight="700"
                fill="#1f2937"
                pointerEvents="none"
              >
                {pos.name}
              </text>

              {/* Checkmark for selected metros */}
              {isSelected(metro) && (
                <g>
                  <circle
                    cx={pos.x + radius - 4}
                    cy={pos.y - radius + 4}
                    r="8"
                    fill="#10b981"
                    stroke="white"
                    strokeWidth="2"
                  />
                  <text
                    x={pos.x + radius - 4}
                    y={pos.y - radius + 8}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="bold"
                    fill="white"
                    pointerEvents="none"
                  >
                    ✓
                  </text>
                </g>
              )}
            </g>
          );
        })}
        </svg>
      </div>

      {/* Hover tooltip */}
      {hoveredMetro && metroStressLevels && (
        <div className="map-tooltip">
          <h4>{hoveredMetro.name}</h4>
          <p><strong>Province:</strong> {hoveredMetro.province}</p>
          <p><strong>Population:</strong> {(hoveredMetro.population / 1000000).toFixed(1)}M</p>
          {metroStressLevels.get(hoveredMetro.id) && (
            <>
              <p>
                <strong>Stress Level:</strong>{' '}
                <span style={{
                  color: metroStressLevels.get(hoveredMetro.id)!.level === 'CRITICAL' ? '#dc2626' :
                    metroStressLevels.get(hoveredMetro.id)!.level === 'HIGH' ? '#ea580c' :
                      metroStressLevels.get(hoveredMetro.id)!.level === 'MEDIUM' ? '#f59e0b' : '#16a34a'
                }}>
                  {metroStressLevels.get(hoveredMetro.id)!.level}
                </span>
              </p>
              <p>
                <strong>Wastage:</strong> {metroStressLevels.get(hoveredMetro.id)!.wastage.toFixed(1)}%
              </p>
            </>
          )}
          <p className="click-hint">Click to {isSelected(hoveredMetro) ? 'deselect' : 'select'}</p>
        </div>
      )}

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
