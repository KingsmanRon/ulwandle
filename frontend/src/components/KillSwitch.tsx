import React, { useEffect, useState } from "react";
import apiService from "../services/apiService";
import { useAuth } from "../auth/AuthContext";
import {
  canonicalOpMessage, hasStoredKey, newNonce, nowIso, signOperation,
} from "../lib/keys";

interface Valve {
  id: number;
  valve_id: string;
  name: string;
  status: string;
  district_id: number;
  is_remote_controlled: boolean;
}

interface Proposal {
  id: number;
  valve_id: number;
  valve_string_id: string;
  valve_name: string | null;
  action: string;
  reason_code: string;
  status: string;
  proposer_id: number;
  approver_id?: number | null;
  nonce: string;
  issued_at: string;
  created_at?: string;
  expires_at: string;
  canonical_approver_message: string;
}

const REASON_CODES = [
  "leak_detected", "quality_breach", "contamination",
  "infrastructure_fault", "scheduled_maintenance", "emergency_other",
];

const KillSwitch: React.FC = () => {
  const { user } = useAuth();
  const isOperator = user && ["operator", "supervisor", "admin"].includes(user.role);
  const isApprover = user && ["supervisor", "admin"].includes(user.role);

  const [valves, setValves] = useState<Valve[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const v = await apiService.getValves();
      setValves(v.valves || []);
      const p = await apiService.listProposals("pending");
      setProposals(p.proposals || []);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Load failed");
    }
  };

  useEffect(() => { refresh(); }, []);

  const propose = async (valve: Valve) => {
    setError(null);
    if (!hasStoredKey()) { setError("Set up your signing key first."); return; }
    const action = window.prompt("Action (open/close/partial):", "close");
    if (!action || !["open", "close", "partial"].includes(action)) return;
    const reasonCode = window.prompt(
      `Reason code:\n${REASON_CODES.join("\n")}`, "infrastructure_fault",
    );
    if (!reasonCode || !REASON_CODES.includes(reasonCode)) {
      setError("Invalid reason code"); return;
    }
    const passphrase = window.prompt("Passphrase to sign with:");
    if (!passphrase) return;

    const nonce = newNonce();
    const issuedAt = nowIso();
    const message = canonicalOpMessage("propose", valve.valve_id, action, nonce, issuedAt);

    setBusy(true);
    try {
      const signature = await signOperation(passphrase, message);
      await apiService.proposeValveOp({
        valve_id: valve.valve_id, action, reason_code: reasonCode,
        nonce, issued_at: issuedAt, signature,
      });
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Proposal failed");
    } finally {
      setBusy(false);
    }
  };

  const approve = async (p: Proposal) => {
    setError(null);
    if (p.proposer_id === user?.id) {
      setError("You cannot approve your own proposal."); return;
    }
    const passphrase = window.prompt(
      `Approve proposal #${p.id}: ${p.action} on ${p.valve_string_id}\n`
      + `Reason: ${p.reason_code}\n\nPassphrase to sign:`,
    );
    if (!passphrase) return;
    setBusy(true);
    try {
      // Reconstruct the canonical approver message locally and verify
      // it matches what the server sent us. The match is for our own
      // safety; the server will re-derive and verify regardless.
      const local = canonicalOpMessage(
        "approve", p.valve_string_id, p.action, p.nonce,
        p.issued_at, p.proposer_id,
      );
      const localStr = new TextDecoder().decode(local);
      if (localStr !== p.canonical_approver_message) {
        throw new Error("Canonical message mismatch — refusing to sign");
      }
      const signature = await signOperation(passphrase, local);
      await apiService.approveProposal(p.id, signature);
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Approval failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="kill-switch">
      <h2>Kill Switch — Dual-Control Valve Operations</h2>
      <p className="warning">
        Every operation requires two distinct, cryptographically signed approvers.
      </p>
      {error && <div role="alert" className="error">{error}</div>}

      <h3>Valves</h3>
      <ul className="valves-grid">
        {valves.map((v) => (
          <li key={v.id} className="valve-card">
            <strong>{v.name}</strong>
            <div>{v.valve_id} · {v.status}</div>
            {isOperator && v.is_remote_controlled && (
              <button disabled={busy} onClick={() => propose(v)}>Propose operation</button>
            )}
          </li>
        ))}
      </ul>

      <h3>Pending proposals</h3>
      {proposals.length === 0 && <p className="muted">No pending proposals.</p>}
      <ul className="valves-grid">
        {proposals.map((p) => (
          <li key={p.id} className="valve-card">
            <strong>#{p.id} — {p.valve_name ?? p.valve_string_id}</strong>
            <div>{p.action} · {p.reason_code}</div>
            <div className="muted">expires {new Date(p.expires_at).toLocaleString()}</div>
            {isApprover && p.proposer_id !== user?.id && (
              <button disabled={busy} onClick={() => approve(p)}>Approve &amp; execute</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default KillSwitch;
