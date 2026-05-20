import React, { useState } from "react";
import { generateAndStoreKeypair } from "../lib/keys";
import { apiService } from "../services/apiService";
import { useAuth } from "./AuthContext";

const SigningKeySetup: React.FC = () => {
  const { refreshMe, user, logout } = useAuth();
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (pass !== confirm) { setErr("Passphrases do not match"); return; }
    if (pass.length < 12) { setErr("Use at least 12 characters"); return; }
    setBusy(true);
    try {
      const { publicKey } = await generateAndStoreKeypair(pass);
      await apiService.registerSigningKey(publicKey);
      await refreshMe();
      setMsg("Signing key registered. Keep your passphrase safe — it cannot be recovered.");
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || "Failed to register key");
    } finally {
      setBusy(false);
      setPass(""); setConfirm("");
    }
  };

  const onLogoutAll = async () => {
    const confirmed = window.confirm(
      "Revoke all of your refresh tokens? Other sessions will need to log in again.",
    );
    if (!confirmed) return;
    try {
      const r = await apiService.logoutAll();
      window.alert(`Revoked ${r.revoked} session${r.revoked === 1 ? "" : "s"}. You will be signed out.`);
      await logout();
    } catch (e: any) {
      window.alert(e?.response?.data?.detail || e?.message || "Failed to revoke sessions");
    }
  };

  return (
    <div className="stacked-panels">
      {user?.has_signing_key ? (
        <div className="card">
          <h2>Signing key</h2>
          <p>A key is registered for {user.email}.</p>
          <p className="muted">
            To rotate the key, contact an administrator. Lost passphrases mean lost
            ability to sign — re-keying revokes the previous public key.
          </p>
        </div>
      ) : (
        <form className="card" onSubmit={onGenerate}>
          <h2>Set up signing key</h2>
          <p>
            Required before you can propose or approve valve operations. Your private
            key never leaves the browser; only the public key is sent to the server.
          </p>
          <label>
            Passphrase (12+ characters)
            <input type="password" minLength={12} value={pass}
                   onChange={(e) => setPass(e.target.value)} required />
          </label>
          <label>
            Confirm
            <input type="password" minLength={12} value={confirm}
                   onChange={(e) => setConfirm(e.target.value)} required />
          </label>
          {err && <div role="alert" className="error">{err}</div>}
          {msg && <div className="success">{msg}</div>}
          <button type="submit" disabled={busy}>{busy ? "Generating…" : "Generate key"}</button>
        </form>
      )}

      <div className="card">
        <h2>Active sessions</h2>
        <p className="muted">
          Revoking sessions invalidates every refresh token issued to your account.
          Other devices will stop being able to refresh and will have to sign in again.
          Use this if you think a token may have been compromised.
        </p>
        <button
          type="button"
          onClick={() => void onLogoutAll()}
          aria-label="Sign out of all sessions"
          style={{
            alignSelf: "flex-start",
            background: "#fef2f2",
            color: "#991b1b",
            border: "1px solid #fecaca",
            padding: "0.6rem 1rem",
            borderRadius: 8,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Sign out of all sessions
        </button>
      </div>
    </div>
  );
};

export default SigningKeySetup;
