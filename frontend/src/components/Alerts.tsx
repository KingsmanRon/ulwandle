import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

const Alerts: React.FC = () => {
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const data = await apiService.getAlerts({ hours: 48 });
      setAlerts(data.alerts || []);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    }
  };

  return (
    <div className="alerts">
      <h2>🚨 System Alerts</h2>
      <div className="alerts-list">
        {alerts.map((alert) => (
          <div key={alert.id} className={`alert-card ${alert.level} ${alert.is_resolved ? 'resolved' : ''}`}>
            <div className="alert-header">
              <h3>{alert.title}</h3>
              <span className={`alert-level ${alert.level}`}>{alert.level}</span>
            </div>
            <p>{alert.message}</p>
            <div className="alert-meta">
              <span>Type: {alert.alert_type}</span>
              <span>Created: {new Date(alert.created_at).toLocaleString()}</span>
              {alert.is_resolved && (
                <span className="resolved-badge">✓ Resolved</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Alerts;
