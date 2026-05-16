import React, { useState } from "react";
import { useAuth } from "./AuthContext";

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const bgStyle: React.CSSProperties = {
    backgroundImage:
      `linear-gradient(135deg, rgba(2, 132, 199, 0.55) 0%, rgba(12, 74, 110, 0.7) 100%), ` +
      `url(${process.env.PUBLIC_URL}/bg.jpg)`,
  };

  return (
    <div className="auth-page" style={bgStyle}>
      <div className="auth-shell">
        <section className="auth-pitch" aria-label="Product overview">
          <h1 className="pitch-title">Ulwandle Tech</h1>
          <p className="pitch-tag">Resource Allocation &amp; Compliance</p>
          <p className="pitch-lede">
            Compliance-grade water-loss reporting, live dam levels, and
            AI-driven action plans for South African metros.
          </p>
          <ul className="pitch-proofs">
            <li>
              <span className="proof-dot" aria-hidden="true" />
              <span>
                <strong>DWS &amp; CoCT-cited data.</strong> Every number on
                the dashboard carries a source URL and refresh timestamp.
              </span>
            </li>
            <li>
              <span className="proof-dot" aria-hidden="true" />
              <span>
                <strong>SANS 241 &amp; National Water Act aligned.</strong>{" "}
                One-click World Bank PforR compliance export.
              </span>
            </li>
            <li>
              <span className="proof-dot" aria-hidden="true" />
              <span>
                <strong>Dual-control kill switch.</strong> Ed25519-signed
                valve operations with a full audit trail.
              </span>
            </li>
          </ul>
          <p className="pitch-footnote">
            Covering 8 metros · 38M+ residents · Stats SA Census 2022
          </p>
        </section>

        <form className="auth-card" onSubmit={onSubmit} autoComplete="on">
          <h2>Sign in</h2>
          <p className="muted">Access the live demo</p>
          <label>
            Email
            <input
              type="email" name="email" autoComplete="username"
              value={email} onChange={(e) => setEmail(e.target.value)} required
            />
          </label>
          <label>
            Password
            <input
              type="password" name="password" autoComplete="current-password"
              minLength={8} value={password}
              onChange={(e) => setPassword(e.target.value)} required
            />
          </label>
          {error && <div role="alert" className="error">{error}</div>}
          <button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
