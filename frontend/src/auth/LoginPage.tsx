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
      <form className="auth-card" onSubmit={onSubmit} autoComplete="on">
        <h1>Ulwandle Tech</h1>
        <p className="muted">Resource Allocation &amp; Compliance</p>
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
  );
};

export default LoginPage;
