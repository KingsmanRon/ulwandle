import React from 'react';
import { MapPin } from 'lucide-react';
import { Metro, EIGHT_METROS } from '../constants/saMetros';
import './MetroSelector.css';

interface MetroSelectorProps {
  selectedMetro: Metro | null;
  onSelect: (metro: Metro) => void;
}

const MetroSelector: React.FC<MetroSelectorProps> = ({ selectedMetro, onSelect }) => {
  return (
    <div className="metro-selector">
      <h3 className="metro-selector-title">
        <MapPin className="map-icon" size={24} />
        Select Metro Municipality
      </h3>
      <div className="metros-grid">
        {EIGHT_METROS.map((metro) => (
          <button
            key={metro.id}
            onClick={() => onSelect(metro)}
            className={`metro-card ${selectedMetro?.id === metro.id ? 'selected' : ''}`}
          >
            <p className="metro-name">{metro.name}</p>
            <p className="metro-province">{metro.province}</p>
            <p className="metro-population">
              Population: {(metro.population / 1000000).toFixed(1)}M
            </p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default MetroSelector;
