import React, { useState } from 'react';
import { Metro, saMetros } from '../constants/saMetros';
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
    return saMetros.find(m => m.id === id);
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

  // Simplified SVG paths for SA metros (approximate shapes)
  // In production, these would be actual GeoJSON boundaries converted to SVG paths
  const metroShapes = {
    jhb: "M 480 180 L 520 180 L 520 220 L 480 220 Z",  // Johannesburg (rectangle)
    cpt: "M 200 450 L 260 450 L 260 500 L 200 500 Z",  // Cape Town
    ethek: "M 530 185 L 570 185 L 570 225 L 530 225 Z",  // Ekurhuleni
    eth: "M 580 280 L 630 280 L 630 330 L 580 330 Z",  // eThekwini
    tsh: "M 470 150 L 510 150 L 510 175 L 470 175 Z",  // Tshwane
    nmb: "M 520 410 L 565 410 L 565 450 L 520 450 Z",  // Nelson Mandela Bay
    buf: "M 530 370 L 570 370 L 570 405 L 530 405 Z",  // Buffalo City
    man: "M 390 320 L 430 320 L 430 360 L 390 360 Z",  // Mangaung
  };

  // Approximate positions for labels
  const metroLabelPositions = {
    jhb: { x: 500, y: 200 },
    cpt: { x: 230, y: 475 },
    ethek: { x: 550, y: 205 },
    eth: { x: 605, y: 305 },
    tsh: { x: 490, y: 162 },
    nmb: { x: 542, y: 430 },
    buf: { x: 550, y: 387 },
    man: { x: 410, y: 340 },
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
        viewBox="0 0 800 600"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* South Africa outline (simplified) */}
        <path
          d="M 150 200 L 700 200 L 700 520 L 150 520 Z"
          fill="#f8fafc"
          stroke="#cbd5e1"
          strokeWidth="2"
          className="sa-outline"
        />

        {/* Province boundaries (simplified) */}
        <line x1="300" y1="200" x2="300" y2="520" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="5,5" />
        <line x1="450" y1="200" x2="450" y2="520" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="5,5" />
        <line x1="600" y1="200" x2="600" y2="520" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="5,5" />

        {/* Metro regions */}
        {saMetros.map((metro) => (
          <g key={metro.id}>
            <path
              d={metroShapes[metro.id as keyof typeof metroShapes]}
              fill={getMetroColor(metro)}
              stroke={isSelected(metro) ? '#1e40af' : '#64748b'}
              strokeWidth={isSelected(metro) ? '3' : '2'}
              className={`metro-region ${isSelected(metro) ? 'selected' : ''} ${hoveredMetro?.id === metro.id ? 'hovered' : ''}`}
              onClick={() => handleMetroClick(metro.id)}
              onMouseEnter={() => handleMetroHover(metro.id)}
              onMouseLeave={() => handleMetroHover(null)}
              style={{ cursor: 'pointer' }}
            />

            {/* Metro labels */}
            <text
              x={metroLabelPositions[metro.id as keyof typeof metroLabelPositions]?.x || 0}
              y={metroLabelPositions[metro.id as keyof typeof metroLabelPositions]?.y || 0}
              className="metro-label"
              textAnchor="middle"
              pointerEvents="none"
            >
              {metro.name.replace('City of ', '').replace(' (Pretoria)', '').replace(' (Durban)', '').replace(' (Bloemfontein)', '')}
            </text>
          </g>
        ))}
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
