import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import { useAuth } from "./auth/AuthContext";
import LoginPage from "./auth/LoginPage";
import SigningKeySetup from "./auth/SigningKeySetup";
import Alerts from "./components/Alerts";
import ClaudeRecommendationsPanel, {
  ClaudeRecommendationsData,
} from "./components/ClaudeRecommendations";
import { apiService } from "./services/apiService";
import Dashboard from "./components/Dashboard";
import DistrictMap from "./components/DistrictMap";
import KillSwitch from "./components/KillSwitch";
import MetroSelector from "./components/MetroSelector";
import MultiMetroAggregate from "./components/MultiMetroAggregate";
import Predictions from "./components/Predictions";
import ShutdownNotification from "./components/ShutdownNotification";
import SouthAfricaMap from "./components/SouthAfricaMap";
import WaterQuality from "./components/WaterQuality";
import {
  Metro,
  METROS,
  generateSyntheticMetroWaterData,
} from "./constants/metros";

// Lazy-loaded heavy panels. Each pulls a distinct chunk of vendor
// weight (recharts, xlsx, the topology constants table) that only
// matters when its sub-tab is opened.
const MetroDashboard = lazy(() => import("./components/MetroDashboard"));
const MetroZoneMap = lazy(() => import("./components/MetroZoneMap"));
const WaterNetworkVisualization = lazy(() => import("./components/WaterNetworkVisualization"));
const WorldBankCompliancePanel = lazy(() => import("./components/WorldBankCompliance"));
const MetroBaselinePanel = lazy(() => import("./components/MetroBaselinePanel"));

const LazyFallback: React.FC = () => <div className="loading">Loading…</div>;

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

// ---------- Navigation: 5 top-level tabs, two with sub-nav ----------

type TopView = "dashboard" | "metros" | "monitoring" | "killswitch" | "settings";

type MetroSubView = "overview" | "sources" | "detail" | "zones" | "network" | "reports";
type MonitoringSubView = "districts" | "quality" | "alerts" | "predictions";

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
  const [view, setView] = useState<TopView>("dashboard");
  const [metroSubView, setMetroSubView] = useState<MetroSubView>("overview");
  const [monitoringSubView, setMonitoringSubView] = useState<MonitoringSubView>("districts");

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

  // Live Claude recommendations — fetched per active metro on demand.
  // Cache-warmed by the backend (1h LRU keyed on metro+NRW bucket).
  const [recommendations, setRecommendations] = useState<ClaudeRecommendationsData | null>(null);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);

  const fetchRecommendations = useCallback(async (metroId: string) => {
    setRecommendationsLoading(true);
    try {
      const data = await apiService.getRecommendations(metroId);
      setRecommendations(data);
    } catch {
      setRecommendations({
        status: "unavailable",
        metro_id: metroId,
        reason: "Could not reach the recommendations service. Try again in a moment.",
      });
    } finally {
      setRecommendationsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeMetro?.id) return;
    fetchRecommendations(activeMetro.id);
  }, [activeMetro?.id, fetchRecommendations]);

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

  // ---------- Sub-views ----------

  const renderMetros = (): React.ReactNode => {
    const subNav = (
      <nav className="sub-nav" aria-label="Metro sections">
        {(["overview", "sources", "detail", "zones", "network", "reports"] as const).map(key => (
          <button
            key={key}
            type="button"
            onClick={() => setMetroSubView(key)}
            className={metroSubView === key ? "active" : undefined}
          >
            {key === "overview"  ? "Overview"  :
             key === "sources"   ? "Sources"   :
             key === "detail"    ? "Detail"    :
             key === "zones"     ? "Zones"     :
             key === "network"   ? "Network"   :
                                   "Reports"}
          </button>
        ))}
      </nav>
    );

    let body: React.ReactNode;
    switch (metroSubView) {
      case "overview":
        body = (
          <div className="stacked-panels">
            <SouthAfricaMap
              selectedMetros={selectedMetros}
              onMetroClick={handleMetroToggle}
              metroStressLevels={metroStressLevels}
            />
            <MetroSelector selectedMetros={selectedMetros} onMultiSelect={handleMultiSelect} />
            {selectedMetroData.length > 0 && (
              <MultiMetroAggregate allMetroData={selectedMetroData} />
            )}
          </div>
        );
        break;
      case "sources":
        body = <MetroBaselinePanel metro={activeMetro} />;
        break;
      case "detail":
        body = (
          <>
            <DemoDataPill note="Representative water-balance model. Replace with buyer's SCADA / billing feed during implementation." />
            <MetroDashboard metroData={activeMetroData} historicalData={historicalData} />
          </>
        );
        break;
      case "zones":
        body = (
          <>
            <DemoDataPill note="Sample DMA topology. Replace with buyer's GIS boundary export during implementation." />
            <MetroZoneMap metro={activeMetro} onZonesUpdate={setActiveMetroZones} />
          </>
        );
        break;
      case "network":
        body = (
          <>
            <DemoDataPill note="Sample pipe network. Replace with buyer's asset-register / hydraulic model during implementation." />
            <WaterNetworkVisualization
              selectedMetroId={activeMetro.id}
              onMetroChange={handleNetworkMetroChange}
            />
          </>
        );
        break;
      case "reports":
        body = (
          <div className="stacked-panels">
            <ClaudeRecommendationsPanel
              recommendations={recommendations}
              loading={recommendationsLoading}
              onRefresh={() => activeMetro?.id && fetchRecommendations(activeMetro.id)}
            />
            <ShutdownNotification metroData={activeMetroData} />
            <WorldBankCompliancePanel
              allMetroData={selectedMetroData}
              selectedMetro={activeMetro}
              zones={activeMetroZones}
              recommendations={recommendations}
              historicalData={historicalData}
            />
          </div>
        );
        break;
    }

    return <>{subNav}{body}</>;
  };

  const renderMonitoring = (): React.ReactNode => {
    const subNav = (
      <nav className="sub-nav" aria-label="Monitoring sections">
        {(["districts", "quality", "alerts", "predictions"] as const).map(key => (
          <button
            key={key}
            type="button"
            onClick={() => setMonitoringSubView(key)}
            className={monitoringSubView === key ? "active" : undefined}
          >
            {key === "districts"   ? "Districts" :
             key === "quality"     ? "Water quality" :
             key === "alerts"      ? "Alerts" :
                                     "Predictions"}
          </button>
        ))}
      </nav>
    );

    let body: React.ReactNode;
    switch (monitoringSubView) {
      case "districts":   body = <DistrictMap />;  break;
      case "quality":     body = <WaterQuality />; break;
      case "alerts":      body = <Alerts />;       break;
      case "predictions": body = <Predictions />;  break;
    }
    return <>{subNav}{body}</>;
  };

  const render = (): React.ReactNode => {
    switch (view) {
      case "dashboard":  return <Dashboard />;
      case "metros":     return renderMetros();
      case "monitoring": return renderMonitoring();
      case "killswitch": return canSeeKillSwitch ? <KillSwitch /> : <NoAccess />;
      case "settings":   return <SigningKeySetup />;
      default:           return <Dashboard />;
    }
  };

  const navButton = (target: TopView, label: string) => (
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

      <nav className="app-nav" aria-label="Main">
        {navButton("dashboard", "Dashboard")}
        {navButton("metros", "Metros")}
        {navButton("monitoring", "Monitoring")}
        {canSeeKillSwitch && navButton("killswitch", "Kill Switch")}
        {navButton("settings", "Signing Key")}
      </nav>

      <main className="app-content">
        <Suspense fallback={<LazyFallback />}>{render()}</Suspense>
      </main>
    </div>
  );
};

const NoAccess: React.FC = () => (
  <div className="card"><h2>Access denied</h2><p>You do not have permission to view this page.</p></div>
);

const DemoDataPill: React.FC<{ note: string }> = ({ note }) => (
  <div className="demo-data-pill" role="status">
    <span>Demo data</span>
    <span className="pill-note">— {note}</span>
  </div>
);

export default App;
