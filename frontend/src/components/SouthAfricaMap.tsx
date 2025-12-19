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

  // Metro positions on the map (matching actual South Africa geography)
  // Coordinates are for a 1000x800 viewBox matching the reference map
  const metroPositions = {
    cpt: { x: 200, y: 680, name: "Cape Town" },           // Western Cape - Southwest coast
    nelson: { x: 520, y: 720, name: "Nelson Mandela Bay" }, // Eastern Cape - Southeast coast (Port Elizabeth)
    buffalo: { x: 600, y: 700, name: "Buffalo City" },    // Eastern Cape - East coast (East London)
    ethek: { x: 750, y: 580, name: "Durban" },            // KwaZulu-Natal - East coast
    manguang: { x: 480, y: 540, name: "Bloemfontein" },   // Free State - Central interior
    jhb: { x: 580, y: 380, name: "Johannesburg" },        // Gauteng - Northeast interior
    ekhur: { x: 620, y: 385, name: "Ekurhuleni" },        // Gauteng - East of Johannesburg
    tshwane: { x: 575, y: 350, name: "Pretoria" },        // Gauteng - North of Johannesburg
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
          {/* Clean Background Map Image - Place your South Africa map here */}
          <image
            href="/sa-provinces-map.png"
            x="0"
            y="0"
            width="1000"
            height="800"
            preserveAspectRatio="xMidYMid meet"
          />

        {/* Metro markers - Only overlays on clean image */}
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
