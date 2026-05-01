import React, { useState } from "react";
import "./App.css";
import { useAuth } from "./auth/AuthContext";
import LoginPage from "./auth/LoginPage";
import SigningKeySetup from "./auth/SigningKeySetup";
import Dashboard from "./components/Dashboard";
import DistrictMap from "./components/DistrictMap";
import WaterQuality from "./components/WaterQuality";
import KillSwitch from "./components/KillSwitch";
import Predictions from "./components/Predictions";
import Alerts from "./components/Alerts";

const App: React.FC = () => {
  const { user, loading, logout } = useAuth();
  const [view, setView] = useState<string>("dashboard");

  if (loading) return <div className="app-loading">Loading…</div>;
  if (!user) return <LoginPage />;

  const canSeeKillSwitch = ["operator", "supervisor", "admin"].includes(user.role);

  const render = () => {
    switch (view) {
      case "dashboard":   return <Dashboard />;
      case "districts":   return <DistrictMap />;
      case "quality":     return <WaterQuality />;
      case "killswitch":  return canSeeKillSwitch ? <KillSwitch /> : <NoAccess />;
      case "predictions": return <Predictions />;
      case "alerts":      return <Alerts />;
      case "settings":    return <SigningKeySetup />;
      default:            return <Dashboard />;
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-content">
          <h1>Ulwandle Tech</h1>
          <p className="tagline">Resource Allocation &amp; Compliance</p>
        </div>
        <div className="header-status">
          <span>{user.full_name} · {user.role}</span>
          <button onClick={logout}>Sign out</button>
        </div>
      </header>

      <nav className="app-nav">
        <button onClick={() => setView("dashboard")}>Dashboard</button>
        <button onClick={() => setView("districts")}>Districts</button>
        <button onClick={() => setView("quality")}>Water Quality</button>
        {canSeeKillSwitch && (
          <button onClick={() => setView("killswitch")}>Kill Switch</button>
        )}
        <button onClick={() => setView("predictions")}>Predictions</button>
        <button onClick={() => setView("alerts")}>Alerts</button>
        <button onClick={() => setView("settings")}>Signing Key</button>
      </nav>

      <main className="app-content">{render()}</main>
    </div>
  );
};

const NoAccess: React.FC = () => (
  <div className="card"><h2>Access denied</h2><p>You do not have permission to view this page.</p></div>
);

export default App;
