import React from 'react';
import { MapPin, CheckCircle } from 'lucide-react';
import { Metro, METROS } from '../constants/metros';
import './MetroSelector.css';

interface MetroSelectorProps {
  selectedMetros: Metro[];
  onMultiSelect: (metros: Metro[]) => void;
}

const MetroSelector: React.FC<MetroSelectorProps> = ({ selectedMetros, onMultiSelect }) => {
  const isMetroSelected = (metro: Metro) =>
    selectedMetros.some(m => m.id === metro.id);

  const handleToggleMetro = (metro: Metro) => {
    if (isMetroSelected(metro)) {
      onMultiSelect(selectedMetros.filter(m => m.id !== metro.id));
    } else {
      onMultiSelect([...selectedMetros, metro]);
    }
  };

  return (
    <div className="metro-selector">
      <div className="metro-selector-header">
        <h3 className="metro-selector-title">
          <MapPin className="map-icon" size={24} />
          Select metro municipalities
        </h3>
        <div className="selection-info">
          <span className="selection-count">
            {selectedMetros.length} of {METROS.length} selected
          </span>
          {selectedMetros.length > 0 && (
            <button onClick={() => onMultiSelect([])} className="clear-selection-btn">
              Clear all
            </button>
          )}
        </div>
      </div>
      <p className="metro-hint">Click on metros to select multiple. Selected metros will be exported together.</p>
      <div className="metros-grid">
        {METROS.map(metro => {
          const selected = isMetroSelected(metro);
          return (
            <button
              key={metro.id}
              onClick={() => handleToggleMetro(metro)}
              className={`metro-card ${selected ? 'selected' : ''}`}
              aria-pressed={selected}
            >
              {selected && (
                <div className="selected-indicator">
                  <CheckCircle size={20} />
                </div>
              )}
              <p className="metro-name">{metro.name}</p>
              <p className="metro-province">{metro.province}</p>
              <p className="metro-population">
                Population: {(metro.population / 1_000_000).toFixed(1)}M
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MetroSelector;
