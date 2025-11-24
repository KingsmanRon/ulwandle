import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

const DistrictMap: React.FC = () => {
  const [districts, setDistricts] = useState<any[]>([]);

  useEffect(() => {
    loadDistricts();
  }, []);

  const loadDistricts = async () => {
    try {
      const data = await apiService.getDistricts();
      setDistricts(data.districts || []);
    } catch (error) {
      console.error('Failed to load districts:', error);
    }
  };

  return (
    <div className="district-map">
      <h2>District Overview</h2>
      <div className="districts-grid">
        {districts.map((district) => (
          <div key={district.id} className={`district-card status-${district.status}`}>
            <h3>{district.name}</h3>
            <p><strong>Code:</strong> {district.code}</p>
            <p><strong>Municipality:</strong> {district.municipality}</p>
            <p><strong>Province:</strong> {district.province}</p>
            <p><strong>Population:</strong> {district.population?.toLocaleString()}</p>
            <div className={`status-badge ${district.status}`}>
              {district.status.toUpperCase()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DistrictMap;
