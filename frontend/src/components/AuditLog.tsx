import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  apiClient, apiService,
  type AuditLogPage, type AuditLogQuery, type AuditLogRow,
} from "../services/apiService";
import "./AuditLog.css";

// Compliance evidence page. Admin/supervisor only — the backend enforces
// this; the navigation entry is hidden for everyone else.
const PAGE_SIZE = 50;

const AuditLog: React.FC = () => {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [actorEmail, setActorEmail] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [hours, setHours] = useState(168);
  const [data, setData] = useState<AuditLogPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const query: AuditLogQuery = useMemo(() => ({
    page,
    page_size: PAGE_SIZE,
    hours,
    action: action.trim() || undefined,
    actor_email: actorEmail.trim() || undefined,
    resource_type: resourceType.trim() || undefined,
  }), [page, hours, action, actorEmail, resourceType]);

  const fetchPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await apiService.getAuditLogs(query);
      setData(body);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load audit log";
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { void fetchPage(); }, [fetchPage]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  // CSV export needs to ride the auth header — fetch as blob, then trigger
  // a download. A plain <a href> would lose the Bearer token.
  const downloadCsv = useCallback(async () => {
    setDownloading(true);
    try {
      const url = apiService.auditLogsExportUrl({
        hours,
        action: action.trim() || undefined,
        actor_email: actorEmail.trim() || undefined,
        resource_type: resourceType.trim() || undefined,
      });
      const res = await apiClient.get(url, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `audit-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setDownloading(false);
    }
  }, [hours, action, actorEmail, resourceType]);

  return (
    <section className="audit-log" aria-labelledby="audit-log-title">
      <header className="audit-log-header">
        <h2 id="audit-log-title">Audit log</h2>
        <p className="muted">
          Append-only record of authentication events, valve operations,
          and configuration changes. Filtered server-side; exports a
          point-in-time CSV for compliance evidence.
        </p>
      </header>

      <form
        className="audit-log-filters"
        onSubmit={(e) => { e.preventDefault(); setPage(1); void fetchPage(); }}
        role="search"
        aria-label="Audit log filters"
      >
        <label>
          <span>Action</span>
          <input
            type="text"
            placeholder="e.g. valve.executed"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          />
        </label>
        <label>
          <span>Actor email</span>
          <input
            type="email"
            placeholder="user@example.com"
            value={actorEmail}
            onChange={(e) => setActorEmail(e.target.value)}
          />
        </label>
        <label>
          <span>Resource type</span>
          <input
            type="text"
            placeholder="valve, user, ..."
            value={resourceType}
            onChange={(e) => setResourceType(e.target.value)}
          />
        </label>
        <label>
          <span>Window (hours)</span>
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            aria-label="Lookback window in hours"
          >
            <option value={24}>Last 24 hours</option>
            <option value={168}>Last 7 days</option>
            <option value={720}>Last 30 days</option>
            <option value={2160}>Last 90 days</option>
          </select>
        </label>
        <div className="audit-log-actions">
          <button type="submit" disabled={loading}>Filter</button>
          <button type="button" onClick={() => void downloadCsv()} disabled={downloading}>
            {downloading ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </form>

      {error && <div className="error" role="alert">{error}</div>}

      <div className="audit-log-table-wrap" role="region" aria-label="Audit log entries">
        <table className="audit-log-table">
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Actor</th>
              <th scope="col">Action</th>
              <th scope="col">Resource</th>
              <th scope="col">Payload</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="muted">Loading…</td></tr>
            )}
            {!loading && data && data.logs.length === 0 && (
              <tr><td colSpan={5} className="muted">No entries match these filters.</td></tr>
            )}
            {!loading && data && data.logs.map((row: AuditLogRow) => (
              <tr key={row.id}>
                <td className="audit-when">
                  {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                </td>
                <td>{row.actor_email || (row.actor_id ? `#${row.actor_id}` : "system")}</td>
                <td><code>{row.action}</code></td>
                <td>
                  {row.resource_type ? (
                    <>
                      <span className="muted">{row.resource_type}</span>
                      {row.resource_id ? <> · <code>{row.resource_id}</code></> : null}
                    </>
                  ) : "—"}
                </td>
                <td>
                  {row.payload ? (
                    <details>
                      <summary>view</summary>
                      <pre>{JSON.stringify(row.payload, null, 2)}</pre>
                    </details>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && (
        <nav className="audit-log-pager" aria-label="Audit log pagination">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading}>
            ← Previous
          </button>
          <span className="muted">
            Page {data.page} of {totalPages} · {data.total.toLocaleString()} entries
          </span>
          <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages || loading}>
            Next →
          </button>
        </nav>
      )}
    </section>
  );
};

export default AuditLog;
