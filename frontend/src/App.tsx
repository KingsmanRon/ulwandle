import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { Download, AlertTriangle } from 'lucide-react';
import { apiService } from './services/apiService';
import Dashboard from './components/Dashboard';
import DistrictMap from './components/DistrictMap';
import WaterQuality from './components/WaterQuality';
import KillSwitch from './components/KillSwitch';
import Predictions from './components/Predictions';
import Alerts from './components/Alerts';
import WorldBankCompliancePanel from './components/WorldBankCompliance';
import MetroSelector from './components/MetroSelector';
import MetroDashboard from './components/MetroDashboard';
import ClaudeRecommendationsPanel, { ClaudeRecommendationsData } from './components/ClaudeRecommendations';
import { Metro, MetroWaterData, generateMetroWaterData } from './constants/saMetros';
import { blockchainVerifier, VerificationResult } from './services/blockchainService';

function App() {
  const [currentView, setCurrentView] = useState<string>('metros');
  const [systemStatus, setSystemStatus] = useState<any>(null);

  // PWA state
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // Metro monitoring state
  const [selectedMetro, setSelectedMetro] = useState<Metro | null>(null);
  const [currentMetroData, setCurrentMetroData] = useState<MetroWaterData | null>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [verificationStatus, setVerificationStatus] = useState<VerificationResult>({
    valid: false,
    totalBlocks: 0
  });
  const [claudeRecommendations, setClaudeRecommendations] = useState<ClaudeRecommendationsData | null>(null);
  const [loadingRecommendations, setLoadingRecommendations] = useState<boolean>(false);

  // PWA Install Prompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallPWA = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstallPrompt(null);
      }
    }
  };

  // Online/Offline Detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // System status
  useEffect(() => {
    loadSystemStatus();
    const interval = setInterval(loadSystemStatus, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadSystemStatus = async () => {
    try {
      const status = await apiService.getSystemStatus();
      setSystemStatus(status);
    } catch (error) {
      console.error('Failed to load system status:', error);
    }
  };

  // Metro Selection Handler
  const handleMetroSelect = useCallback(async (metro: Metro) => {
    setSelectedMetro(metro);

    // Generate current data
    const data = generateMetroWaterData(metro);

    // Create verified blockchain entry
    const block = await blockchainVerifier.createBlock(data);
    data.blockchainHash = block.hash;

    setCurrentMetroData(data);

    // Generate historical data (7 days)
    const historical = [];
    for (let i = 6; i >= 0; i--) {
      const dayData = generateMetroWaterData(metro);
      historical.push({
        day: i === 0 ? 'Today' : `${i}d ago`,
        intake: dayData.intake,
        usage: dayData.usage,
        wastage: dayData.wastage
      });
    }
    setHistoricalData(historical);

    // Verify blockchain
    const verification = await blockchainVerifier.verifyChain();
    setVerificationStatus(verification);

    // Get Claude recommendations (simulated for now)
    setLoadingRecommendations(true);
    setTimeout(() => {
      setClaudeRecommendations(getFallbackRecommendations(data));
      setLoadingRecommendations(false);
    }, 1500);
  }, []);

  // Auto-update metro data
  useEffect(() => {
    if (selectedMetro && currentView === 'metros') {
      const interval = setInterval(() => {
        handleMetroSelect(selectedMetro);
      }, 30000); // Update every 30 seconds

      return () => clearInterval(interval);
    }
  }, [selectedMetro, currentView, handleMetroSelect]);

  // Export for World Bank
  const handleExportForWorldBank = useCallback(() => {
    const exportData = blockchainVerifier.exportForWorldBank();
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `world-bank-verification-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const getFallbackRecommendations = (metroData: MetroWaterData): ClaudeRecommendationsData => {
    return {
      priority: metroData.wastagePercentage > 30 ? 'CRITICAL' : metroData.wastagePercentage > 20 ? 'HIGH' : 'MEDIUM',
      recommendations: [
        {
          title: 'Implement Advanced Leak Detection',
          description: 'Deploy acoustic sensors and AI-powered leak detection across distribution network',
          impact: '15-25 ML/day reduction',
          cost: 'R50-80 million',
          timeline: '12-18 months',
          kpis: ['Leak detection time <4 hours', 'Leak repair completion <24 hours']
        },
        {
          title: 'Smart Meter Rollout',
          description: 'Install smart water meters for real-time monitoring and leak alerts',
          impact: '10-15 ML/day through early detection',
          cost: 'R120-180 million',
          timeline: '24-36 months',
          kpis: ['100% smart meter coverage', 'Customer leak alerts within 1 hour']
        },
        {
          title: 'Pressure Management Zones',
          description: 'Create pressure management zones to reduce pipe bursts and background leakage',
          impact: '20-30 ML/day reduction',
          cost: 'R30-50 million per zone',
          timeline: '6-12 months per zone',
          kpis: ['Pressure maintained 200-400 kPa', 'Burst frequency reduction 40%']
        }
      ],
      potentialSavings: '45-70 ML/day total',
      roi: 'Investment recovered within 3-5 years through water savings'
    };
  };

  const renderView = () => {
    switch (currentView) {
      case 'metros':
        return (
          <>
            <WorldBankCompliancePanel
              verificationStatus={verificationStatus}
              onExport={handleExportForWorldBank}
            />
            <MetroSelector
              selectedMetro={selectedMetro}
              onSelect={handleMetroSelect}
            />
            {currentMetroData && (
              <>
                <MetroDashboard
                  metroData={currentMetroData}
                  historicalData={historicalData}
                />
                <ClaudeRecommendationsPanel
                  recommendations={claudeRecommendations}
                  loading={loadingRecommendations}
                  onRefresh={() => handleMetroSelect(selectedMetro!)}
                />
              </>
            )}
          </>
        );
      case 'dashboard':
        return <Dashboard />;
      case 'districts':
        return <DistrictMap />;
      case 'quality':
        return <WaterQuality />;
      case 'killswitch':
        return <KillSwitch />;
      case 'predictions':
        return <Predictions />;
      case 'alerts':
        return <Alerts />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-content">
          <h1>🌊 Ulwandle Tech</h1>
          <p className="tagline">Resource Allocation & Compliance (RAC)</p>
        </div>
        <div className="header-status">
          {!isOnline && (
            <div className="offline-indicator">
              <AlertTriangle size={20} />
              Offline Mode
            </div>
          )}
          {installPrompt && (
            <button onClick={handleInstallPWA} className="install-button">
              <Download size={20} />
              Install App
            </button>
          )}
          {systemStatus && (
            <>
              <span className="status-indicator status-operational">
                System: {systemStatus.system_status}
              </span>
              <span className="status-time">
                Last updated: {new Date(systemStatus.last_updated).toLocaleTimeString()}
              </span>
            </>
          )}
        </div>
      </header>

      <nav className="app-nav">
        <button
          className={currentView === 'metros' ? 'active' : ''}
          onClick={() => setCurrentView('metros')}
        >
          🌍 SA Metros
        </button>
        <button
          className={currentView === 'dashboard' ? 'active' : ''}
          onClick={() => setCurrentView('dashboard')}
        >
          📊 Dashboard
        </button>
        <button
          className={currentView === 'districts' ? 'active' : ''}
          onClick={() => setCurrentView('districts')}
        >
          🗺️ Districts
        </button>
        <button
          className={currentView === 'quality' ? 'active' : ''}
          onClick={() => setCurrentView('quality')}
        >
          💧 Water Quality
        </button>
        <button
          className={currentView === 'killswitch' ? 'active' : ''}
          onClick={() => setCurrentView('killswitch')}
        >
          🔴 Kill Switch
        </button>
        <button
          className={currentView === 'predictions' ? 'active' : ''}
          onClick={() => setCurrentView('predictions')}
        >
          🤖 AI Predictions
        </button>
        <button
          className={currentView === 'alerts' ? 'active' : ''}
          onClick={() => setCurrentView('alerts')}
        >
          🚨 Alerts
        </button>
      </nav>

      <main className="app-content">
        {renderView()}
      </main>

      <footer className="app-footer">
        <p>Ulwandle Tech - Built for South Africa's Water Infrastructure</p>
        <p>Powered by Claude AI | World Bank PforR Program | South Africa Program-for-Results</p>
      </footer>
    </div>
  );
}

export default App;
