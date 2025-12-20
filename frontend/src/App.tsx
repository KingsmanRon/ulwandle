import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { Download, AlertTriangle } from 'lucide-react';
import { apiService } from './services/apiService';
import WorldBankCompliancePanel from './components/WorldBankCompliance';
import MetroSelector from './components/MetroSelector';
import MetroDashboard from './components/MetroDashboard';
import MultiMetroAggregate from './components/MultiMetroAggregate';
import SouthAfricaMap from './components/SouthAfricaMap';
import MetroZoneMap from './components/MetroZoneMap';
import WaterNetworkVisualization from './components/WaterNetworkVisualization';
import ClaudeRecommendationsPanel, { ClaudeRecommendationsData } from './components/ClaudeRecommendations';
import ShutdownNotification from './components/ShutdownNotification';
import { Metro, MetroWaterData, generateMetroWaterData, EIGHT_METROS } from './constants/saMetros';
import { blockchainVerifier } from './services/blockchainService';

function App() {
  const [systemStatus, setSystemStatus] = useState<any>(null);

  // PWA state
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // Metro monitoring state
  const [selectedMetros, setSelectedMetros] = useState<Metro[]>([]);
  const [selectedMetro, setSelectedMetro] = useState<Metro | null>(null);
  const [currentMetroData, setCurrentMetroData] = useState<MetroWaterData | null>(null);
  const [allMetroData, setAllMetroData] = useState<MetroWaterData[]>([]);
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

  // Metro Multi-Select Handler
  const handleMetroMultiSelect = useCallback(async (metros: Metro[]) => {
    setSelectedMetros(metros);

    // Generate data for all selected metros
    const allData: MetroWaterData[] = [];
    for (const metro of metros) {
      const data = generateMetroWaterData(metro);
      const block = await blockchainVerifier.createBlock(data);
      data.blockchainHash = block.hash;
      allData.push(data);
    }
    setAllMetroData(allData);

    // Set the first metro as the primary for display
    if (metros.length > 0) {
      setSelectedMetro(metros[0]);
      setCurrentMetroData(allData[0]);

      // Generate historical data for first metro
      const historical = [];
      for (let i = 6; i >= 0; i--) {
        const dayData = generateMetroWaterData(metros[0]);
        historical.push({
          day: i === 0 ? 'Today' : `${i}d ago`,
          intake: dayData.intake,
          usage: dayData.usage,
          wastage: dayData.wastage
        });
      }
      setHistoricalData(historical);

      // Get Claude recommendations
      setLoadingRecommendations(true);
      setTimeout(() => {
        setClaudeRecommendations(getFallbackRecommendations(allData[0]));
        setLoadingRecommendations(false);
      }, 1500);
    } else {
      setSelectedMetro(null);
      setCurrentMetroData(null);
      setAllMetroData([]);
    }
  }, []);

  // Single Metro Selection Handler (for backward compatibility)
  const handleMetroSelect = useCallback(async (metro: Metro) => {
    await handleMetroMultiSelect([metro]);
  }, [handleMetroMultiSelect]);

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

  // Smooth scroll to section with offset for sticky nav
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const navHeight = 80; // Height of sticky nav bar
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - navHeight;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
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
        <button onClick={() => scrollToSection('map-section')} className="nav-btn">
          🗺️ SA Map
        </button>
        <button onClick={() => scrollToSection('metro-section')} className="nav-btn">
          🏙️ Select Metro
        </button>
        <button onClick={() => scrollToSection('dashboard-section')} className="nav-btn">
          📈 Dashboard
        </button>
        {selectedMetro && (
          <>
            <button onClick={() => scrollToSection('zones-section')} className="nav-btn">
              📍 Problem Areas
            </button>
            <button onClick={() => scrollToSection('network-section')} className="nav-btn">
              💧 Water Distribution Network
            </button>
          </>
        )}
        <button onClick={() => scrollToSection('shutdown-section')} className="nav-btn">
          🚨 Shutdown Notice
        </button>
        <button onClick={() => scrollToSection('recommendations-section')} className="nav-btn">
          🤖 AI Recommendations
        </button>
      </nav>

      <main className="app-content">
        {/* Phase 1: South Africa Map with Metro Highlighting */}
        <div id="map-section">
          <SouthAfricaMap
            selectedMetros={selectedMetros}
            onMetroClick={(metro) => {
              // Toggle selection
              if (selectedMetros.some(m => m.id === metro.id)) {
                handleMetroMultiSelect(selectedMetros.filter(m => m.id !== metro.id));
              } else {
                handleMetroMultiSelect([...selectedMetros, metro]);
              }
            }}
            metroStressLevels={new Map(
              allMetroData.map(data => [
                data.metroId,
                { level: data.stressLevel, wastage: data.wastagePercentage }
              ])
            )}
          />
        </div>

        <div id="metro-section">
          <MetroSelector
            selectedMetros={selectedMetros}
            onMultiSelect={handleMetroMultiSelect}
          />
        </div>
        <WorldBankCompliancePanel
          allMetroData={allMetroData}
        />
        {allMetroData.length > 1 && (
          <div id="aggregate-section">
            <MultiMetroAggregate allMetroData={allMetroData} />
          </div>
        )}
        {currentMetroData && (
          <>
            <div id="dashboard-section">
              <MetroDashboard
                metroData={currentMetroData}
                historicalData={historicalData}
              />
            </div>

            {/* Phase 2: Zone-based Problem Area Visualization */}
            {selectedMetro && (
              <div id="zones-section">
                <MetroZoneMap metro={selectedMetro} />
              </div>
            )}

            {/* Water Distribution Network */}
            {selectedMetro && (
              <div id="network-section">
                <WaterNetworkVisualization
                  selectedMetroId={selectedMetro.id}
                  onMetroChange={(metroId) => {
                    const metro = EIGHT_METROS.find(m => m.id === metroId);
                    if (metro) {
                      handleMetroSelect(metro);
                    }
                  }}
                />
              </div>
            )}

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
