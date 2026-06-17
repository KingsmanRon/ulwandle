import React from 'react';
import { Droplets, TrendingUp, AlertTriangle, Users, BarChart3 } from 'lucide-react';
import { MetroWaterData } from '../constants/metros';
import './MultiMetroAggregate.css';

interface MultiMetroAggregateProps {
  allMetroData: MetroWaterData[];
}

const STRESS_COLOURS: Record<string, string> = {
  CRITICAL: '#dc2626',
  HIGH: '#ea580c',
  MEDIUM: '#f59e0b',
  LOW: '#16a34a',
};

const MultiMetroAggregate: React.FC<MultiMetroAggregateProps> = ({ allMetroData }) => {
  if (allMetroData.length === 0) return null;

  const totalIntake = allMetroData.reduce((s, m) => s + m.intake, 0);
  const totalUsage = allMetroData.reduce((s, m) => s + m.usage, 0);
  const totalWastage = allMetroData.reduce((s, m) => s + m.wastage, 0);
  const totalPopulation = allMetroData.reduce((s, m) => s + m.population, 0);

  const averageWastagePercentage = totalIntake > 0 ? (totalWastage / totalIntake) * 100 : 0;
  const averagePerCapita = totalPopulation > 0 ? (totalUsage * 1_000_000) / totalPopulation : 0;

  const overallStressLevel = (() => {
    const criticalCount = allMetroData.filter(m => m.stressLevel === 'CRITICAL').length;
    const highCount = allMetroData.filter(m => m.stressLevel === 'HIGH').length;
    if (criticalCount > 0) return 'CRITICAL';
    if (highCount >= allMetroData.length / 2) return 'HIGH';
    if (averageWastagePercentage > 25) return 'MEDIUM';
    return 'LOW';
  })();

  const stressColour = STRESS_COLOURS[overallStressLevel] || '#6b7280';

  const highestWastage = allMetroData.reduce((max, m) =>
    m.wastagePercentage > max.wastagePercentage ? m : max);
  const lowestWastage = allMetroData.reduce((min, m) =>
    m.wastagePercentage < min.wastagePercentage ? m : min);

  return (
    <div className="multi-metro-aggregate">
      <div className="aggregate-header">
        <h2>
          <BarChart3 size={24} />
          Combined analysis: {allMetroData.length} metro{allMetroData.length > 1 ? 's' : ''} selected
        </h2>
        <div className="overall-stress-badge" style={{ backgroundColor: stressColour }}>
          {overallStressLevel} stress
        </div>
      </div>

      <div className="aggregate-metrics-grid">
        <div className="aggregate-metric-card">
          <div className="metric-icon" style={{ backgroundColor: '#3b82f6' }}>
            <Droplets size={24} />
          </div>
          <div className="metric-content">
            <h3>Total water intake</h3>
            <p className="metric-value">{totalIntake.toFixed(2)} <span className="unit">ML/day</span></p>
            <p className="metric-subtitle">Combined daily intake</p>
          </div>
        </div>

        <div className="aggregate-metric-card">
          <div className="metric-icon" style={{ backgroundColor: '#10b981' }}>
            <TrendingUp size={24} />
          </div>
          <div className="metric-content">
            <h3>Total actual usage</h3>
            <p className="metric-value">{totalUsage.toFixed(2)} <span className="unit">ML/day</span></p>
            <p className="metric-subtitle">Combined consumption</p>
          </div>
        </div>

        <div className="aggregate-metric-card">
          <div className="metric-icon" style={{ backgroundColor: '#ef4444' }}>
            <AlertTriangle size={24} />
          </div>
          <div className="metric-content">
            <h3>Total wastage (NRW)</h3>
            <p className="metric-value">{totalWastage.toFixed(2)} <span className="unit">ML/day</span></p>
            <p className="metric-subtitle">{averageWastagePercentage.toFixed(1)}% of total intake</p>
          </div>
        </div>

        <div className="aggregate-metric-card">
          <div className="metric-icon" style={{ backgroundColor: '#8b5cf6' }}>
            <Users size={24} />
          </div>
          <div className="metric-content">
            <h3>Average per capita</h3>
            <p className="metric-value">{averagePerCapita.toFixed(1)} <span className="unit">L/person/day</span></p>
            <p className="metric-subtitle">{(totalPopulation / 1_000_000).toFixed(1)}M total population</p>
          </div>
        </div>
      </div>

      <div className="individual-metros-section">
        <h3 className="section-title">Individual metro breakdown</h3>
        <div className="individual-metros-grid">
          {allMetroData.map(metro => (
            <div key={metro.metroId} className="individual-metro-card">
              <div className="metro-card-header">
                <h4>{metro.metro}</h4>
                <span className="stress-badge" style={{ backgroundColor: STRESS_COLOURS[metro.stressLevel] }}>
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
                  <span className="stat-label">Per capita:</span>
                  <span className="stat-value">{metro.perCapita.toFixed(0)} L/p/d</span>
                  <span className="stat-percentage">
                    {(metro.population / 1_000_000).toFixed(1)}M pop
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="aggregate-insights">
        <h3>Key insights</h3>
        <ul>
          <li>
            <strong>Highest wastage:</strong> {highestWastage.metro} at {highestWastage.wastagePercentage.toFixed(1)}% NRW
          </li>
          <li>
            <strong>Lowest wastage:</strong> {lowestWastage.metro} at {lowestWastage.wastagePercentage.toFixed(1)}% NRW
          </li>
          <li>
            <strong>Daily water-loss value:</strong> Approximately R{(totalWastage * 12000).toLocaleString()}
            <span className="insight-note"> (at R12/kL replacement cost)</span>
          </li>
          <li>
            <strong>Potential annual saving:</strong> R{((totalWastage * 12000 * 365) / 1_000_000).toFixed(1)}M
            <span className="insight-note"> if wastage reduced by 50%</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default MultiMetroAggregate;
