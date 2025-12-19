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

  // Metro positions on the map (approximate geographic locations)
  const metroPositions = {
    jhb: { x: 580, y: 280, name: "Johannesburg" },
    cpt: { x: 280, y: 580, name: "Cape Town" },
    ekhur: { x: 620, y: 290, name: "Ekurhuleni" },
    ethek: { x: 700, y: 350, name: "Durban" },
    tshwane: { x: 560, y: 250, name: "Pretoria" },
    nelson: { x: 520, y: 530, name: "NM Bay" },
    buffalo: { x: 560, y: 490, name: "Buffalo City" },
    manguang: { x: 490, y: 360, name: "Bloemfontein" },
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

      <svg
        className="sa-map-svg"
        viewBox="0 0 800 650"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background */}
        <rect width="800" height="650" fill="#e0f2fe" />

        {/* South Africa outline (more realistic shape) */}
        <path
          d="M 250 150
             L 280 140 L 320 135 L 360 138 L 400 145 L 440 155 L 480 165 L 520 175 L 560 185 L 600 195
             L 640 210 L 680 230 L 710 250 L 730 280 L 740 310 L 745 340 L 748 370 L 750 400
             L 748 430 L 740 460 L 728 490 L 710 515 L 685 535 L 655 550 L 620 560 L 580 568
             L 540 572 L 500 574 L 460 574 L 420 572 L 380 568 L 340 562 L 300 554 L 260 544
             L 230 530 L 210 512 L 195 490 L 185 465 L 180 440 L 178 415 L 180 390 L 185 365
             L 192 340 L 200 315 L 210 290 L 220 265 L 230 240 L 235 215 L 238 190 L 242 165
             L 245 155 Z"
          fill="#f0fdf4"
          stroke="#059669"
          strokeWidth="3"
          className="sa-outline"
        />

        {/* Province labels (light gray text) */}
        <text x="300" y="300" fill="#94a3b8" fontSize="14" fontWeight="600" opacity="0.4">Western Cape</text>
        <text x="450" y="400" fill="#94a3b8" fontSize="14" fontWeight="600" opacity="0.4">Eastern Cape</text>
        <text x="600" y="260" fill="#94a3b8" fontSize="14" fontWeight="600" opacity="0.4">Gauteng</text>
        <text x="680" y="360" fill="#94a3b8" fontSize="14" fontWeight="600" opacity="0.4">KZN</text>

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
