// Operational-layer dashboard — districts, sensors, valves, leaks.
// Backed by tables that aren't seeded yet (populated by the future
// SCADA integration). Kept here for re-use once real sensor data
// flows. The active Dashboard component lives in Dashboard.tsx.

import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import './Dashboard.css';

const LegacyDashboard: React.FC = () => {
  const [overview, setOverview] = useState<any>(null);
  const [realtimeMetrics, setRealtimeMetrics] = useState<any>(null);
  const [criticalIssues, setCriticalIssues] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      const [overviewData, metricsData, issuesData] = await Promise.all([
        apiService.getDashboardOverview(),
        apiService.getRealtimeMetrics(),
        apiService.getCriticalIssues()
      ]);

      setOverview(overviewData);
      setRealtimeMetrics(metricsData);
      setCriticalIssues(issuesData);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div className="dashboard">
      <h2>System Overview</h2>

      <div className="stats-grid">
        <div className="stat-card districts">
          <h3>Districts</h3>
          <div className="stat-value">{overview?.districts?.total || 0}</div>
          <div className="stat-breakdown">
            <span className="status-green">✓ {overview?.districts?.green || 0} Green</span>
            <span className="status-yellow">⚠ {overview?.districts?.yellow || 0} Yellow</span>
            <span className="status-red">✗ {overview?.districts?.red || 0} Red</span>
          </div>
        </div>

        <div className="stat-card alerts">
          <h3>Alerts (24h)</h3>
          <div className="stat-value">{overview?.alerts?.total_24h || 0}</div>
          <div className="stat-breakdown">
            <span>Unresolved: {overview?.alerts?.unresolved || 0}</span>
            <span className="critical">Critical: {overview?.alerts?.critical || 0}</span>
          </div>
        </div>

        <div className="stat-card sensors">
          <h3>Sensors</h3>
          <div className="stat-value">{overview?.sensors?.active || 0}/{overview?.sensors?.total || 0}</div>
          <div className="stat-breakdown">
            <span>Active sensors</span>
          </div>
        </div>

        <div className="stat-card valves">
          <h3>Valves</h3>
          <div className="stat-value">{overview?.valves?.total || 0}</div>
          <div className="stat-breakdown">
            <span>Open: {overview?.valves?.open || 0}</span>
            <span>Closed: {overview?.valves?.closed || 0}</span>
            <span className="fault">Fault: {overview?.valves?.fault || 0}</span>
          </div>
        </div>

        <div className="stat-card leaks">
          <h3>Active Leaks</h3>
          <div className="stat-value">{overview?.leaks?.active_leaks || 0}</div>
          <div className="stat-breakdown">
            <span>Loss: {overview?.leaks?.estimated_total_loss_lpm || 0} L/min</span>
          </div>
        </div>

        <div className="stat-card flow">
          <h3>Current Flow</h3>
          <div className="stat-value">{realtimeMetrics?.flow_metrics?.current_flow_lpm?.toFixed(1) || 0} L/min</div>
          <div className="stat-breakdown">
            <span>Avg: {realtimeMetrics?.flow_metrics?.average_flow_1h?.toFixed(1) || 0} L/min</span>
          </div>
        </div>
      </div>

      {criticalIssues && criticalIssues.summary && (
        <div className="critical-issues">
          <h3>🚨 Critical Issues</h3>

          {criticalIssues.summary.red_districts > 0 && (
            <div className="issue-section">
              <h4>Red-Flagged Districts ({criticalIssues.summary.red_districts})</h4>
              <div className="issue-list">
                {criticalIssues.red_flagged_districts?.map((district: any) => (
                  <div key={district.id} className="issue-item critical">
                    <strong>{district.name}</strong>
                    <span>{district.municipality}</span>
                    <span>Population: {district.population?.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {criticalIssues.summary.active_leaks > 0 && (
            <div className="issue-section">
              <h4>Active Leaks ({criticalIssues.summary.active_leaks})</h4>
              <div className="issue-list">
                {criticalIssues.active_leaks?.slice(0, 5).map((leak: any) => (
                  <div key={leak.id} className="issue-item warning">
                    <strong>{leak.location}</strong>
                    <span>Loss: {leak.estimated_loss_lpm} L/min</span>
                    <span>Confidence: {(leak.confidence * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {criticalIssues.summary.critical_alerts > 0 && (
            <div className="issue-section">
              <h4>Critical Alerts ({criticalIssues.summary.critical_alerts})</h4>
              <div className="issue-list">
                {criticalIssues.critical_alerts?.slice(0, 5).map((alert: any) => (
                  <div key={alert.id} className="issue-item alert">
                    <strong>{alert.title}</strong>
                    <span>{alert.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="recent-predictions">
        <h3>Recent AI Predictions</h3>
        <div className="predictions-list">
          {overview?.recent_predictions?.map((pred: any) => (
            <div key={pred.id} className="prediction-item">
              <span className="pred-type">{pred.type}</span>
              <span className="pred-confidence">Confidence: {(pred.confidence * 100).toFixed(0)}%</span>
              <span className="pred-time">{new Date(pred.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LegacyDashboard;
