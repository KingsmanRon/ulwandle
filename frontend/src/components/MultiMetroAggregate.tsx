import React from 'react';
import { MetroWaterData } from '../constants/saMetros';
import { Droplets, TrendingUp, AlertTriangle, Users, BarChart3 } from 'lucide-react';
import './MultiMetroAggregate.css';

interface MultiMetroAggregateProps {
  allMetroData: MetroWaterData[];
}

const MultiMetroAggregate: React.FC<MultiMetroAggregateProps> = ({ allMetroData }) => {
  if (allMetroData.length === 0) {
    return null;
  }

  // Calculate aggregates
  const totalIntake = allMetroData.reduce((sum, metro) => sum + metro.intake, 0);
  const totalUsage = allMetroData.reduce((sum, metro) => sum + metro.usage, 0);
  const totalWastage = allMetroData.reduce((sum, metro) => sum + metro.wastage, 0);
  const totalPopulation = allMetroData.reduce((sum, metro) => sum + metro.population, 0);

  const averageWastagePercentage = (totalWastage / totalIntake) * 100;
  const averagePerCapita = (totalUsage / totalPopulation) * 1000000; // Convert ML to liters per person

  // Determine overall stress level
  const getOverallStressLevel = (): string => {
    const criticalCount = allMetroData.filter(m => m.stressLevel === 'CRITICAL').length;
    const highCount = allMetroData.filter(m => m.stressLevel === 'HIGH').length;

    if (criticalCount > 0) return 'CRITICAL';
    if (highCount >= allMetroData.length / 2) return 'HIGH';
    if (averageWastagePercentage > 25) return 'MEDIUM';
    return 'LOW';
  };

  const overallStressLevel = getOverallStressLevel();

  const getStressLevelColor = (level: string): string => {
    switch (level) {
      case 'CRITICAL': return '#dc2626';
      case 'HIGH': return '#ea580c';
      case 'MEDIUM': return '#f59e0b';
      case 'LOW': return '#16a34a';
      default: return '#6b7280';
    }
  };

  return (
    <div className="multi-metro-aggregate">
      <div className="aggregate-header">
        <h2>
          <BarChart3 size={24} />
          Combined Analysis: {allMetroData.length} Metro{allMetroData.length > 1 ? 's' : ''} Selected
        </h2>
        <div
          className="overall-stress-badge"
          style={{ backgroundColor: getStressLevelColor(overallStressLevel) }}
        >
          {overallStressLevel} STRESS
        </div>
      </div>

      <div className="aggregate-metrics-grid">
        <div className="aggregate-metric-card">
          <div className="metric-icon" style={{ backgroundColor: '#3b82f6' }}>
            <Droplets size={24} />
          </div>
          <div className="metric-content">
            <h3>Total Water Intake</h3>
            <p className="metric-value">{totalIntake.toFixed(2)} <span className="unit">ML/day</span></p>
            <p className="metric-subtitle">Combined daily intake</p>
          </div>
        </div>

        <div className="aggregate-metric-card">
          <div className="metric-icon" style={{ backgroundColor: '#10b981' }}>
            <TrendingUp size={24} />
          </div>
          <div className="metric-content">
            <h3>Total Actual Usage</h3>
            <p className="metric-value">{totalUsage.toFixed(2)} <span className="unit">ML/day</span></p>
            <p className="metric-subtitle">Combined consumption</p>
          </div>
        </div>

        <div className="aggregate-metric-card">
          <div className="metric-icon" style={{ backgroundColor: '#ef4444' }}>
            <AlertTriangle size={24} />
          </div>
          <div className="metric-content">
            <h3>Total Wastage (NRW)</h3>
            <p className="metric-value">{totalWastage.toFixed(2)} <span className="unit">ML/day</span></p>
            <p className="metric-subtitle">{averageWastagePercentage.toFixed(1)}% of total intake</p>
          </div>
        </div>

        <div className="aggregate-metric-card">
          <div className="metric-icon" style={{ backgroundColor: '#8b5cf6' }}>
            <Users size={24} />
          </div>
          <div className="metric-content">
            <h3>Average Per Capita</h3>
            <p className="metric-value">{averagePerCapita.toFixed(1)} <span className="unit">L/person/day</span></p>
            <p className="metric-subtitle">{(totalPopulation / 1000000).toFixed(1)}M total population</p>
          </div>
        </div>
      </div>

      <div className="individual-metros-section">
        <h3 className="section-title">Individual Metro Breakdown</h3>
        <div className="individual-metros-grid">
          {allMetroData.map((metro, index) => (
            <div key={metro.metroId} className="individual-metro-card">
              <div className="metro-card-header">
                <h4>{metro.metro}</h4>
                <span
                  className="stress-badge"
                  style={{ backgroundColor: getStressLevelColor(metro.stressLevel) }}
                >
                  {metro.stressLevel}
                </span>
              </div>
              <div className="metro-card-stats">
                <div className="stat-row">
                  <span className="stat-label">Intake:</span>
                  <span className="stat-value">{metro.intake.toFixed(1)} ML/day</span>
                  <span className="stat-percentage">
                    ({((metro.intake / totalIntake) * 100).toFixed(1)}% of total)
                  </span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Usage:</span>
                  <span className="stat-value">{metro.usage.toFixed(1)} ML/day</span>
                  <span className="stat-percentage">
                    ({((metro.usage / totalUsage) * 100).toFixed(1)}% of total)
                  </span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Wastage:</span>
                  <span className="stat-value wastage">{metro.wastage.toFixed(1)} ML/day</span>
                  <span className="stat-percentage wastage">
                    ({metro.wastagePercentage.toFixed(1)}% NRW)
                  </span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Per Capita:</span>
                  <span className="stat-value">{metro.perCapita.toFixed(0)} L/p/d</span>
                  <span className="stat-percentage">
                    {(metro.population / 1000000).toFixed(1)}M pop
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="aggregate-insights">
        <h3>📊 Key Insights</h3>
        <ul>
          <li>
            <strong>Highest Wastage:</strong> {
              allMetroData.reduce((max, metro) =>
                metro.wastagePercentage > max.wastagePercentage ? metro : max
              ).metro
            } at {
              allMetroData.reduce((max, metro) =>
                metro.wastagePercentage > max.wastagePercentage ? metro : max
              ).wastagePercentage.toFixed(1)
            }% NRW
          </li>
          <li>
            <strong>Lowest Wastage:</strong> {
              allMetroData.reduce((min, metro) =>
                metro.wastagePercentage < min.wastagePercentage ? metro : min
              ).metro
            } at {
              allMetroData.reduce((min, metro) =>
                metro.wastagePercentage < min.wastagePercentage ? metro : min
              ).wastagePercentage.toFixed(1)
            }% NRW
          </li>
          <li>
            <strong>Daily Water Loss Value:</strong> Approximately R{(totalWastage * 400).toLocaleString()}
            <span className="insight-note"> (at R400/ML bulk water cost)</span>
          </li>
          <li>
            <strong>Potential Annual Savings:</strong> R{((totalWastage * 400 * 365) / 1000000).toFixed(1)}M
            <span className="insight-note"> if wastage reduced by 50%</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default MultiMetroAggregate;
