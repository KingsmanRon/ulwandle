import React from 'react';
import { MapPin, CheckCircle } from 'lucide-react';
import { Metro, EIGHT_METROS } from '../constants/saMetros';
import './MetroSelector.css';

interface MetroSelectorProps {
  selectedMetros: Metro[];
  onMultiSelect: (metros: Metro[]) => void;
}

const MetroSelector: React.FC<MetroSelectorProps> = ({ selectedMetros, onMultiSelect }) => {
  const handleToggleMetro = (metro: Metro) => {
    const isSelected = selectedMetros.some(m => m.id === metro.id);

    if (isSelected) {
      // Remove metro from selection
      onMultiSelect(selectedMetros.filter(m => m.id !== metro.id));
    } else {
      // Add metro to selection
      onMultiSelect([...selectedMetros, metro]);
    }
  };

  const isMetroSelected = (metro: Metro) => {
    return selectedMetros.some(m => m.id === metro.id);
  };

  return (
    <div className="metro-selector">
      <div className="metro-selector-header">
        <h3 className="metro-selector-title">
          <MapPin className="map-icon" size={24} />
          Select Metro Municipalities
        </h3>
        <div className="selection-info">
          <span className="selection-count">
            {selectedMetros.length} of {EIGHT_METROS.length} selected
          </span>
          {selectedMetros.length > 0 && (
            <button
              onClick={() => onMultiSelect([])}
              className="clear-selection-btn"
            >
              Clear All
            </button>
          )}
        </div>
      </div>
      <p className="metro-hint">Click on metros to select multiple. Selected metros will be exported together.</p>
      <div className="metros-grid">
        {EIGHT_METROS.map((metro) => {
          const selected = isMetroSelected(metro);
          return (
            <button
              key={metro.id}
              onClick={() => handleToggleMetro(metro)}
              className={`metro-card ${selected ? 'selected' : ''}`}
            >
              {selected && (
                <div className="selected-indicator">
                  <CheckCircle size={20} />
                </div>
              )}
              <p className="metro-name">{metro.name}</p>
              <p className="metro-province">{metro.province}</p>
              <p className="metro-population">
                Population: {(metro.population / 1000000).toFixed(1)}M
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MetroSelector;
