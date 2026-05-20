import React, { useCallback, useEffect, useState } from "react";
import { apiClient, apiService } from "../services/apiService";

interface AlertRow {
  id: number;
  alert_type: string;
  level: "info" | "warning" | "critical" | "emergency";
  title: string;
  message: string;
  district_id: number | null;
  is_resolved: boolean;
  created_at: string;
  resolved_at: string | null;
}

const Alerts: React.FC = () => {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.getAlerts({ hours: 48, page: 1, page_size: 100 });
      setAlerts((data.alerts || []) as AlertRow[]);
    } catch (error) {
      console.error("Failed to load alerts:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  const downloadCsv = useCallback(async () => {
    setDownloading(true);
    try {
      const url = apiService.alertsExportUrl({ hours: 168, limit: 10_000 });
      const res = await apiClient.get(url, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `alerts-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setDownloading(false);
    }
  }, []);

  return (
    <section className="alerts" aria-labelledby="alerts-title">
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <h2 id="alerts-title">System alerts</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={() => void loadAlerts()}
            disabled={loading}
            aria-label="Refresh alerts"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => void downloadCsv()}
            disabled={downloading}
            aria-label="Export alerts as CSV"
          >
            {downloading ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </header>
      <ul className="alerts-list" aria-live="polite">
        {alerts.length === 0 && !loading && (
          <li className="muted">No alerts in the last 48 hours.</li>
        )}
        {alerts.map((alert) => (
          <li
            key={alert.id}
            className={`alert-card ${alert.level} ${alert.is_resolved ? "resolved" : ""}`}
          >
            <div className="alert-header">
              <h3>{alert.title}</h3>
              <span className={`alert-level ${alert.level}`} aria-label={`Severity: ${alert.level}`}>
                {alert.level}
              </span>
            </div>
            <p>{alert.message}</p>
            <div className="alert-meta">
              <span>Type: {alert.alert_type}</span>
              <span>Created: {new Date(alert.created_at).toLocaleString()}</span>
              {alert.is_resolved && (
                <span className="resolved-badge" aria-label="This alert has been resolved">
                  Resolved
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default Alerts;
