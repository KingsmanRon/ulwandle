import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

const WaterQuality: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    loadComplianceSummary();
  }, []);

  const loadComplianceSummary = async () => {
    try {
      const data = await apiService.getComplianceSummary();
      setSummary(data);
    } catch (error) {
      console.error('Failed to load compliance summary:', error);
    }
  };

  return (
    <div className="water-quality">
      <h2>Water Quality & Compliance</h2>
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
