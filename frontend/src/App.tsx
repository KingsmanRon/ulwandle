import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { Download, AlertTriangle } from 'lucide-react';
import { apiService } from './services/apiService';
import WorldBankCompliancePanel from './components/WorldBankCompliance';
import MetroSelector from './components/MetroSelector';
import MetroDashboard from './components/MetroDashboard';
import ClaudeRecommendationsPanel, { ClaudeRecommendationsData } from './components/ClaudeRecommendations';
import ShutdownNotification from './components/ShutdownNotification';
import { Metro, MetroWaterData, generateMetroWaterData } from './constants/saMetros';
import { blockchainVerifier } from './services/blockchainService';

function App() {
  const [systemStatus, setSystemStatus] = useState<any>(null);

  // PWA state
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // Metro monitoring state
  const [selectedMetro, setSelectedMetro] = useState<Metro | null>(null);
  const [currentMetroData, setCurrentMetroData] = useState<MetroWaterData | null>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
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

    // Create blockchain block for data integrity
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

    // Get Claude recommendations (simulated for now)
    setLoadingRecommendations(true);
    setTimeout(() => {
      setClaudeRecommendations(getFallbackRecommendations(data));
      setLoadingRecommendations(false);
    }, 1500);
  }, []);

  // Auto-update metro data
  useEffect(() => {
    if (selectedMetro) {
      const interval = setInterval(() => {
        handleMetroSelect(selectedMetro);
      }, 30000); // Update every 30 seconds

      return () => clearInterval(interval);
    }
  }, [selectedMetro, handleMetroSelect]);


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

  // Smooth scroll to section
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

      <nav className="quick-nav">
        <button onClick={() => scrollToSection('export-section')} className="nav-btn">
          📊 Export Data
        </button>
        <button onClick={() => scrollToSection('metro-section')} className="nav-btn">
          🏙️ Select Metro
        </button>
        <button onClick={() => scrollToSection('dashboard-section')} className="nav-btn">
          📈 Dashboard
        </button>
        <button onClick={() => scrollToSection('shutdown-section')} className="nav-btn">
          🚨 Shutdown Notice
        </button>
        <button onClick={() => scrollToSection('recommendations-section')} className="nav-btn">
          🤖 AI Recommendations
        </button>
      </nav>

      <main className="app-content">
        <div id="export-section">
          <WorldBankCompliancePanel
            metroData={currentMetroData}
          />
        </div>
        <div id="metro-section">
          <MetroSelector
            selectedMetro={selectedMetro}
            onSelect={handleMetroSelect}
          />
        </div>
        {currentMetroData && (
          <>
            <div id="dashboard-section">
              <MetroDashboard
                metroData={currentMetroData}
                historicalData={historicalData}
              />
            </div>
            <div id="shutdown-section">
              <ShutdownNotification
                metroData={currentMetroData}
              />
            </div>
            <div id="recommendations-section">
              <ClaudeRecommendationsPanel
                recommendations={claudeRecommendations}
                loading={loadingRecommendations}
                onRefresh={() => handleMetroSelect(selectedMetro!)}
              />
            </div>
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>Ulwandle Tech - Built for South Africa's Water Infrastructure</p>
        <p>Powered by Claude AI | South Africa Program-for-Results</p>
      </footer>
    </div>
  );
}

export default App;
