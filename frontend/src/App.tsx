import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import { useAuth } from "./auth/AuthContext";
import LoginPage from "./auth/LoginPage";
import SigningKeySetup from "./auth/SigningKeySetup";
import Alerts from "./components/Alerts";
import ClaudeRecommendationsPanel, {
  ClaudeRecommendationsData,
} from "./components/ClaudeRecommendations";
import Dashboard from "./components/Dashboard";
import DistrictMap from "./components/DistrictMap";
import KillSwitch from "./components/KillSwitch";
import MetroDashboard from "./components/MetroDashboard";
import MetroSelector from "./components/MetroSelector";
import MetroZoneMap from "./components/MetroZoneMap";
import MultiMetroAggregate from "./components/MultiMetroAggregate";
import Predictions from "./components/Predictions";
import ShutdownNotification from "./components/ShutdownNotification";
import SouthAfricaMap from "./components/SouthAfricaMap";
import WaterNetworkVisualization from "./components/WaterNetworkVisualization";
import WaterQuality from "./components/WaterQuality";
import WorldBankCompliancePanel from "./components/WorldBankCompliance";
import {
  Metro,
  METROS,
  generateSyntheticMetroWaterData,
} from "./constants/metros";

// `beforeinstallprompt` is not in the standard DOM lib — type it
// ourselves so we never have to use `any`.
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

// Synthetic 7-day series used by the metro dashboard chart and the
// compliance export until a real timeseries source exists.
interface HistoricalPoint {
  day: string;
  intake: number;
  usage: number;
  wastage: number;
}

function buildHistoricalSeries(intake: number, wastagePercentage: number): HistoricalPoint[] {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return days.map((day, i) => {
    const variance = 0.88 + ((i * 31) % 25) / 100;
    const dayIntake = parseFloat((intake * variance).toFixed(2));
    const dayWastage = parseFloat((dayIntake * (wastagePercentage / 100)).toFixed(2));
    const dayUsage = parseFloat((dayIntake - dayWastage).toFixed(2));
    return { day, intake: dayIntake, usage: dayUsage, wastage: dayWastage };
  });
}

type View =
  | "dashboard"
  | "districts"
  | "quality"
  | "killswitch"
  | "predictions"
  | "alerts"
  | "settings"
  | "sa-map"
  | "metros"
  | "metro-detail"
  | "problem-areas"
  | "network"
  | "notices"
  | "compliance"
  | "recommendations";

interface ZoneData {
  zone_id: string;
  name: string;
  population: number;
  daily_intake_ml: number;
  daily_usage_ml: number;
  daily_wastage_ml: number;
  wastage_percentage: number;
  has_active_leaks: boolean;
  leak_count: number;
  priority_score: number;
}

const App: React.FC = () => {
  const { user, loading, logout } = useAuth();
  const [view, setView] = useState<View>("dashboard");

  const [selectedMetros, setSelectedMetros] = useState<Metro[]>([METROS[0]]);
  const activeMetro: Metro = selectedMetros[0] ?? METROS[0];

  const selectedMetroData = useMemo(
    () => selectedMetros.map(generateSyntheticMetroWaterData),
    [selectedMetros],
  );
  const activeMetroData = useMemo(
    () => generateSyntheticMetroWaterData(activeMetro),
    [activeMetro],
  );
  const historicalData = useMemo(
    () => buildHistoricalSeries(activeMetroData.intake, activeMetroData.wastagePercentage),
    [activeMetroData],
  );

  const metroStressLevels = useMemo(() => {
    const m = new Map<string, { level: string; wastage: number }>();
    for (const metro of METROS) {
      const data = generateSyntheticMetroWaterData(metro);
      m.set(metro.id, { level: data.stressLevel, wastage: data.wastagePercentage });
    }
    return m;
  }, []);

  const [activeMetroZones, setActiveMetroZones] = useState<ZoneData[]>([]);

  // Live Claude recommendations are not wired in this PR; reserved for follow-up.
  const [recommendations] = useState<ClaudeRecommendationsData | null>(null);

  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setInstallPrompt(null);
  }, [installPrompt]);

  const handleMetroToggle = useCallback((metro: Metro) => {
    setSelectedMetros(prev =>
      prev.some(m => m.id === metro.id)
        ? prev.filter(m => m.id !== metro.id)
        : [...prev, metro],
    );
  }, []);

  const handleMultiSelect = useCallback((metros: Metro[]) => {
    setSelectedMetros(metros);
  }, []);

  const handleNetworkMetroChange = useCallback((metroId: string) => {
    const metro = METROS.find(m => m.id === metroId);
    if (metro) setSelectedMetros([metro]);
  }, []);

  if (loading) return <div className="app-loading">Loading…</div>;
  if (!user) return <LoginPage />;

  const canSeeKillSwitch = ["operator", "supervisor", "admin"].includes(user.role);

  const render = (): React.ReactNode => {
    switch (view) {
      case "dashboard":   return <Dashboard />;
      case "districts":   return <DistrictMap />;
      case "quality":     return <WaterQuality />;
      case "killswitch":  return canSeeKillSwitch ? <KillSwitch /> : <NoAccess />;
      case "predictions": return <Predictions />;
      case "alerts":      return <Alerts />;
      case "settings":    return <SigningKeySetup />;

      case "sa-map":
        return (
          <SouthAfricaMap
            selectedMetros={selectedMetros}
            onMetroClick={handleMetroToggle}
            metroStressLevels={metroStressLevels}
          />
        );

      case "metros":
        return (
          <>
            <MetroSelector selectedMetros={selectedMetros} onMultiSelect={handleMultiSelect} />
            {selectedMetroData.length > 0 && (
              <MultiMetroAggregate allMetroData={selectedMetroData} />
            )}
          </>
        );

      case "metro-detail":
        return <MetroDashboard metroData={activeMetroData} historicalData={historicalData} />;

      case "problem-areas":
        return <MetroZoneMap metro={activeMetro} onZonesUpdate={setActiveMetroZones} />;

      case "network":
        return (
          <WaterNetworkVisualization
            selectedMetroId={activeMetro.id}
            onMetroChange={handleNetworkMetroChange}
          />
        );

      case "notices":
        return <ShutdownNotification metroData={activeMetroData} />;

      case "compliance":
        return (
          <WorldBankCompliancePanel
            allMetroData={selectedMetroData}
            selectedMetro={activeMetro}
            zones={activeMetroZones}
            recommendations={recommendations}
            historicalData={historicalData}
          />
        );

      case "recommendations":
        return (
          <ClaudeRecommendationsPanel
            recommendations={recommendations}
            loading={false}
            onRefresh={() => { /* Live Claude wiring is a follow-up PR. */ }}
          />
        );

      default:
        return <Dashboard />;
    }
  };

  const navButton = (target: View, label: string) => (
    <button
      key={target}
      onClick={() => setView(target)}
      className={view === target ? "active" : undefined}
      type="button"
    >
      {label}
    </button>
  );

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-content">
          <h1>Ulwandle Tech</h1>
          <p className="tagline">Resource Allocation &amp; Compliance</p>
        </div>
        <div className="header-status">
          <span>{user.full_name} · {user.role}</span>
          {installPrompt && (
            <button onClick={handleInstallClick} type="button" style={{ marginRight: "0.5rem" }}>
              Install app
            </button>
          )}
          <button onClick={logout} type="button">Sign out</button>
        </div>
      </header>

      <nav className="app-nav">
        {navButton("dashboard", "Dashboard")}
        {navButton("districts", "Districts")}
        {navButton("quality", "Water Quality")}
        {canSeeKillSwitch && navButton("killswitch", "Kill Switch")}
        {navButton("predictions", "Predictions")}
        {navButton("alerts", "Alerts")}
        {navButton("sa-map", "SA Map")}
        {navButton("metros", "Metros")}
        {navButton("metro-detail", "Metro Detail")}
        {navButton("problem-areas", "Problem Areas")}
        {navButton("network", "Network")}
        {navButton("notices", "Notices")}
        {navButton("compliance", "Compliance")}
        {navButton("recommendations", "Recommendations")}
        {navButton("settings", "Signing Key")}
      </nav>

      <main className="app-content">{render()}</main>
    </div>
  );
};

const NoAccess: React.FC = () => (
  <div className="card"><h2>Access denied</h2><p>You do not have permission to view this page.</p></div>
);

export default App;
