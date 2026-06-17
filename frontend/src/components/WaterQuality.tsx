import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

const WaterQuality: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadComplianceSummary();
  }, []);

  const loadComplianceSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getComplianceSummary();
      setSummary(data);
    } catch (error) {
      console.error('Failed to load compliance summary:', error);
      setError('Water-quality compliance data could not be loaded. Check the API connection or try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="water-quality">
      <h2>Water Quality & Compliance</h2>
      {loading && <div className="monitoring-state">Loading water-quality summary…</div>}
      {!loading && error && <div className="monitoring-state error">{error}</div>}
      {!loading && !error && summary && (summary.districts?.length ?? 0) === 0 && (
        <div className="monitoring-state">No water-quality readings are available yet.</div>
      )}
      {summary && (
        <>
          <div className="stats-row">
            <div className="stat">Total Districts: {summary.total_districts}</div>
            <div className="stat status-green">Green: {summary.green}</div>
            <div className="stat status-yellow">Yellow: {summary.yellow}</div>
            <div className="stat status-red">Red: {summary.red}</div>
          </div>
          <div className="districts-list">
            {summary.districts?.map((district: any) => (
              <div key={district.id} className={`district-quality status-${district.status}`}>
                <h3>{district.name}</h3>
                <p>{district.municipality}, {district.province}</p>
                {district.latest_reading && (
                  <div className="reading">
                    <p>pH: {district.latest_reading.ph || 'N/A'}</p>
                    <p>TDS: {district.latest_reading.tds || 'N/A'} mg/L</p>
                    <p>Meets Standards: {district.latest_reading.meets_standards ? '✓' : '✗'}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default WaterQuality;
