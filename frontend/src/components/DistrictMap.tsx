import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

const DistrictMap: React.FC = () => {
  const [districts, setDistricts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDistricts();
  }, []);

  const loadDistricts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getDistricts();
      setDistricts(data.districts || []);
    } catch (error) {
      console.error('Failed to load districts:', error);
      setError('District data could not be loaded. Check the API connection or try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="district-map">
      <h2>District Overview</h2>
      {loading && <div className="monitoring-state">Loading districts…</div>}
      {!loading && error && <div className="monitoring-state error">{error}</div>}
      {!loading && !error && districts.length === 0 && (
        <div className="monitoring-state">No districts are available yet.</div>
      )}
      <div className="districts-grid">
        {districts.map((district) => (
          <div key={district.id} className={`district-card status-${district.status}`}>
            <h3>{district.name}</h3>
            <p><strong>Code:</strong> {district.code}</p>
            <p><strong>Municipality:</strong> {district.municipality}</p>
            <p><strong>Province:</strong> {district.province}</p>
            <p><strong>Population:</strong> {district.population != null ? district.population.toLocaleString() : "Unknown"}</p>
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
