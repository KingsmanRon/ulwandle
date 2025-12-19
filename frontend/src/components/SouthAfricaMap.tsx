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

  // Metro positions on the map (geographic locations matching new coordinates)
  const metroPositions = {
    jhb: { x: 585, y: 590, name: "Johannesburg" },
    cpt: { x: 180, y: 780, name: "Cape Town" },
    ekhur: { x: 620, y: 600, name: "Ekurhuleni" },
    ethek: { x: 760, y: 710, name: "Durban" },
    tshwane: { x: 570, y: 570, name: "Pretoria" },
    nelson: { x: 530, y: 820, name: "Nelson Mandela Bay" },
    buffalo: { x: 630, y: 800, name: "Buffalo City" },
    manguang: { x: 480, y: 680, name: "Bloemfontein" },
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
        viewBox="0 0 900 700"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background - Ocean */}
        <rect width="900" height="700" fill="#d0e7f9" />

        {/* South Africa - Actual Country Outline Matching Reference Map */}
        <path
          d="M 100 600
             L 110 580 L 125 562 L 145 546 L 170 532 L 200 520 L 235 512
             L 275 508 L 320 508 L 365 512 L 410 520 L 455 532 L 498 546
             L 540 562 L 580 580 L 618 600 L 654 622 L 688 646 L 720 672
             L 750 700 L 778 730 L 804 762 L 828 796 L 850 832 L 860 850
             L 855 860 L 840 870 L 820 878 L 795 884 L 765 888 L 730 890
             L 690 889 L 645 885 L 595 878 L 540 868 L 480 855 L 415 840
             L 345 822 L 270 802 L 190 780 L 125 760 L 100 750 L 90 740
             L 85 728 L 82 715 L 80 700 L 80 684 L 82 668 L 85 652 L 90 636
             L 96 620 L 100 600
             Z"
          fill="#fafaf8"
          stroke="#4b5563"
          strokeWidth="2.5"
          className="sa-outline"
        />

        {/* Lesotho - Landlocked country within SA (eastern area) */}
        <path
          d="M 600 720
             L 618 717 L 635 718 L 650 722 L 662 729 L 671 738
             L 677 749 L 680 761 L 680 773 L 677 785 L 671 796
             L 662 805 L 650 812 L 635 816 L 618 817 L 600 814
             L 585 808 L 573 799 L 565 788 L 560 775 L 558 761
             L 560 747 L 565 734 L 573 723 L 585 714 L 600 720
             Z"
          fill="#d1d5db"
          stroke="#4b5563"
          strokeWidth="1.8"
          strokeDasharray="5,3"
          className="lesotho-outline"
        />

        {/* eSwatini (Swaziland) - Small landlocked country in northeast */}
        <path
          d="M 795 590
             L 807 588 L 818 590 L 827 594 L 833 601 L 835 610
             L 833 619 L 827 626 L 818 630 L 807 632 L 795 630
             L 785 626 L 778 619 L 776 610 L 778 601 L 785 594
             L 795 590
             Z"
          fill="#d1d5db"
          stroke="#4b5563"
          strokeWidth="1.5"
          strokeDasharray="5,3"
          className="eswatini-outline"
        />

        {/* Province labels (subtle background text) positioned on new map) */}
        <text x="150" y="780" fill="#94a3b8" fontSize="16" fontWeight="600" opacity="0.35">Western Cape</text>
        <text x="400" y="820" fill="#94a3b8" fontSize="16" fontWeight="600" opacity="0.35">Eastern Cape</text>
        <text x="480" y="700" fill="#94a3b8" fontSize="16" fontWeight="600" opacity="0.35">Free State</text>
        <text x="580" y="580" fill="#94a3b8" fontSize="15" fontWeight="600" opacity="0.35">Gauteng</text>
        <text x="720" y="730" fill="#94a3b8" fontSize="16" fontWeight="600" opacity="0.35">KZN</text>
        <text x="720" y="620" fill="#94a3b8" fontSize="15" fontWeight="600" opacity="0.35">Mpumalanga</text>
        <text x="620" y="540" fill="#94a3b8" fontSize="15" fontWeight="600" opacity="0.35">Limpopo</text>
        <text x="280" y="660" fill="#94a3b8" fontSize="15" fontWeight="600" opacity="0.35">Northern Cape</text>
        <text x="420" y="590" fill="#94a3b8" fontSize="15" fontWeight="600" opacity="0.35">North West</text>

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
