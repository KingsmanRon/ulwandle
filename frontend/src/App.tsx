import React, { useState, useEffect } from 'react';
import './App.css';
import { apiService } from './services/apiService';
import Dashboard from './components/Dashboard';
import DistrictMap from './components/DistrictMap';
import WaterQuality from './components/WaterQuality';
import KillSwitch from './components/KillSwitch';
import Predictions from './components/Predictions';
import Alerts from './components/Alerts';

function App() {
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [systemStatus, setSystemStatus] = useState<any>(null);

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

  const renderView = () => {
    switch (currentView) {
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
        <p>Powered by Claude AI | South Africa Program-for-Results</p>
      </footer>
    </div>
  );
}

export default App;
