import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

const Alerts: React.FC = () => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getAlerts({ hours: 48 });
      setAlerts(data.alerts || []);
    } catch (error) {
      console.error('Failed to load alerts:', error);
      setError('Alerts could not be loaded. Check the API connection or try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="alerts">
      <h2>🚨 System Alerts</h2>
      {loading && <div className="monitoring-state">Loading alerts…</div>}
      {!loading && error && <div className="monitoring-state error">{error}</div>}
      {!loading && !error && alerts.length === 0 && (
        <div className="monitoring-state">No alerts were raised in the last 48 hours.</div>
      )}
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
