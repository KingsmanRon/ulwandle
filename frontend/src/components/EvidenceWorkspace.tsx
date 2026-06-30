import React, { FormEvent, useCallback, useEffect, useState } from "react";
import { CheckCircle2, Download, FileCheck2, Upload } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { Metro } from "../constants/metros";
import {
  apiService,
  EvidenceSubmission,
} from "../services/apiService";
import "./EvidenceWorkspace.css";


interface EvidenceWorkspaceProps {
  metro: Metro;
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function apiError(error: unknown): string {
  if (
    typeof error === "object"
    && error !== null
    && "response" in error
  ) {
    const response = (error as { response?: { data?: { detail?: string } } }).response;
    if (response?.data?.detail) return response.data.detail;
  }
  return "The evidence request failed. Try again.";
}

const EvidenceWorkspace: React.FC<EvidenceWorkspaceProps> = ({ metro }) => {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<EvidenceSubmission[]>([]);
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getEvidenceSubmissions(metro.id);
      setSubmissions(data.submissions);
    } catch (requestError) {
      setError(apiError(requestError));
    } finally {
      setLoading(false);
    }
  }, [metro.id]);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  const handleImport = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) {
      setError("Choose a CSV evidence file.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const submission = await apiService.importEvidence({
        metroId: metro.id,
        sourceName,
        sourceUrl: sourceUrl || undefined,
        notes: notes || undefined,
        file,
      });
      setMessage(
        `Imported version ${submission.version} as draft. A different supervisor or administrator must approve it.`,
      );
      setSourceName("");
      setSourceUrl("");
      setNotes("");
      setFile(null);
      setFileInputKey((current) => current + 1);
      await loadSubmissions();
    } catch (requestError) {
      setError(apiError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async (submissionId: number) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const approved = await apiService.approveEvidence(submissionId);
      setMessage(
        `Approved version ${approved.version}. Its W10 and W11 evidence pack is ready.`,
      );
      await loadSubmissions();
    } catch (requestError) {
      setError(apiError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const handleTemplate = async () => {
    setError(null);
    try {
      saveBlob(
        await apiService.downloadEvidenceTemplate(),
        "ulwandle_w10_w11_evidence_template.csv",
      );
    } catch (requestError) {
      setError(apiError(requestError));
    }
  };

  const handleExport = async (submission: EvidenceSubmission) => {
    setError(null);
    try {
      const filename = (
        `${submission.metro_id}_W10_W11_`
        + `${submission.reporting_period_end}_v${submission.version}.zip`
      );
      saveBlob(await apiService.exportEvidence(submission.id), filename);
    } catch (requestError) {
      setError(apiError(requestError));
    }
  };

  const canImport = user && ["admin", "supervisor", "operator"].includes(user.role);
  const canApprove = user && ["admin", "supervisor"].includes(user.role);

  return (
    <section className="evidence-workspace">
      <header className="evidence-heading">
        <div>
          <h3>W10 and W11 evidence workspace</h3>
          <p>
            Import twelve approved monthly records for {metro.name}. Ulwandle fingerprints
            the source, calculates deterministic results, and preserves every version.
          </p>
        </div>
        <button type="button" className="secondary-action" onClick={handleTemplate}>
          <Download size={17} />
          CSV template
        </button>
      </header>

      <div className="evidence-method">
        <strong>W10</strong> = system input volume less billed authorised consumption,
        divided by system input volume.{" "}
        <strong>W11</strong> = connection months billed from actual meter readings,
        divided by total connection months.
      </div>

      {canImport && (
        <form className="evidence-import" onSubmit={handleImport}>
          <label>
            Source name
            <input
              value={sourceName}
              onChange={(event) => setSourceName(event.target.value)}
              placeholder="Approved municipal water balance"
              maxLength={200}
              required
            />
          </label>
          <label>
            Source URL
            <input
              type="url"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://..."
              maxLength={500}
            />
          </label>
          <label>
            Evidence CSV
            <input
              key={fileInputKey}
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              required
            />
          </label>
          <label className="evidence-notes">
            Notes
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Approval reference or extract scope"
              maxLength={2000}
            />
          </label>
          <button type="submit" className="primary-action" disabled={busy}>
            <Upload size={17} />
            {busy ? "Working…" : "Import draft"}
          </button>
        </form>
      )}

      {error && <div className="evidence-message error" role="alert">{error}</div>}
      {message && <div className="evidence-message success" role="status">{message}</div>}

      <div className="evidence-list">
        <h4>Submission history</h4>
        {loading && <div className="monitoring-state">Loading evidence submissions…</div>}
        {!loading && submissions.length === 0 && (
          <div className="monitoring-state">
            No evidence has been imported for this metro.
          </div>
        )}
        {submissions.map((submission) => {
          const canApproveThis = (
            Boolean(canApprove)
            && submission.status === "draft"
            && submission.created_by_id !== user?.id
          );
          return (
            <article className="evidence-card" key={submission.id}>
              <div className="evidence-card-head">
                <div>
                  <strong>Version {submission.version}</strong>
                  <span>
                    {submission.reporting_period_start} to {submission.reporting_period_end}
                  </span>
                </div>
                <span className={`evidence-status ${submission.status}`}>
                  {submission.status}
                </span>
              </div>
              <dl className="evidence-details">
                <div><dt>Source</dt><dd>{submission.source_name}</dd></div>
                <div><dt>File</dt><dd>{submission.source_filename}</dd></div>
                <div><dt>Records</dt><dd>{submission.record_count}</dd></div>
                <div>
                  <dt>SHA256</dt>
                  <dd title={submission.source_sha256}>
                    {submission.source_sha256.slice(0, 16)}…
                  </dd>
                </div>
              </dl>
              {submission.calculation && (
                <div className="evidence-results">
                  <div>
                    <span>W10 NRW</span>
                    <strong>{submission.calculation.w10_nrw_pct.toFixed(3)}%</strong>
                  </div>
                  <div>
                    <span>W11 metering</span>
                    <strong>{submission.calculation.w11_metering_pct.toFixed(3)}%</strong>
                  </div>
                  <div>
                    <span>Method</span>
                    <strong>{submission.calculation.methodology_version}</strong>
                  </div>
                </div>
              )}
              <div className="evidence-actions">
                {canApproveThis && (
                  <button
                    type="button"
                    className="primary-action"
                    disabled={busy}
                    onClick={() => handleApprove(submission.id)}
                  >
                    <CheckCircle2 size={17} />
                    Approve
                  </button>
                )}
                {submission.status === "draft" && submission.created_by_id === user?.id && (
                  <span className="approval-note">A second authorised user must approve.</span>
                )}
                {submission.status === "approved" && (
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => handleExport(submission)}
                  >
                    <FileCheck2 size={17} />
                    Export evidence pack
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default EvidenceWorkspace;
