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

  // Metro positions on the map (accurate geographic locations on new map)
  const metroPositions = {
    jhb: { x: 620, y: 310, name: "Johannesburg" },
    cpt: { x: 220, y: 600, name: "Cape Town" },
    ekhur: { x: 660, y: 320, name: "Ekurhuleni" },
    ethek: { x: 780, y: 410, name: "Durban" },
    tshwane: { x: 610, y: 280, name: "Pretoria" },
    nelson: { x: 580, y: 560, name: "Nelson Mandela Bay" },
    buffalo: { x: 650, y: 540, name: "Buffalo City" },
    manguang: { x: 520, y: 390, name: "Bloemfontein" },
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
        viewBox="0 0 1000 800"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background - Ocean */}
        <rect width="1000" height="800" fill="#dbeafe" />

        {/* South Africa - Accurate Geographic Outline */}
        <path
          d="M 150 220
             L 180 210 L 220 205 L 260 202 L 300 200 L 340 198 L 380 196 L 420 195 L 460 194
             L 500 193 L 540 192 L 580 192 L 620 193 L 660 196 L 700 200 L 740 206 L 780 215
             L 810 225 L 835 238 L 855 252 L 870 268 L 880 285 L 887 305 L 892 325 L 895 345
             L 896 365 L 896 385 L 894 405 L 890 425 L 884 445 L 876 465 L 865 485 L 852 503
             L 836 520 L 818 535 L 798 548 L 776 559 L 752 568 L 726 575 L 698 580 L 668 584
             L 636 587 L 602 588 L 566 588 L 528 586 L 488 582 L 446 576 L 402 568 L 356 558
             L 308 546 L 258 532 L 206 516 L 180 506 L 155 494 L 132 480 L 112 464 L 96 446
             L 84 426 L 76 404 L 71 380 L 68 354 L 68 326 L 71 298 L 77 270 L 86 242 L 98 216
             L 112 192 L 128 172 L 150 220 Z"
          fill="#f0fdf4"
          stroke="#059669"
          strokeWidth="2.5"
          className="sa-outline"
        />

        {/* Lesotho - Landlocked country within South Africa */}
        <path
          d="M 520 420
             L 540 415 L 560 413 L 580 415 L 598 420 L 612 428 L 622 438 L 628 450
             L 630 463 L 628 476 L 622 488 L 612 498 L 598 506 L 580 511 L 560 513
             L 540 511 L 522 506 L 508 498 L 498 488 L 492 476 L 490 463 L 492 450
             L 498 438 L 508 428 L 520 420 Z"
          fill="#dbeafe"
          stroke="#059669"
          strokeWidth="1.5"
          strokeDasharray="3,3"
          className="lesotho-outline"
        />

        {/* Province labels (subtle background text) */}
        <text x="200" y="520" fill="#94a3b8" fontSize="16" fontWeight="600" opacity="0.35">Western Cape</text>
        <text x="420" y="520" fill="#94a3b8" fontSize="16" fontWeight="600" opacity="0.35">Eastern Cape</text>
        <text x="520" y="320" fill="#94a3b8" fontSize="16" fontWeight="600" opacity="0.35">Free State</text>
        <text x="620" y="260" fill="#94a3b8" fontSize="15" fontWeight="600" opacity="0.35">Gauteng</text>
        <text x="750" y="340" fill="#94a3b8" fontSize="16" fontWeight="600" opacity="0.35">KZN</text>
        <text x="680" y="240" fill="#94a3b8" fontSize="15" fontWeight="600" opacity="0.35">Mpumalanga</text>
        <text x="550" y="230" fill="#94a3b8" fontSize="15" fontWeight="600" opacity="0.35">Limpopo</text>
        <text x="350" y="330" fill="#94a3b8" fontSize="15" fontWeight="600" opacity="0.35">Northern Cape</text>
        <text x="420" y="250" fill="#94a3b8" fontSize="15" fontWeight="600" opacity="0.35">North West</text>

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
