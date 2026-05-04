import React from 'react';
import {
  PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Droplet, CheckCircle, AlertTriangle, Activity } from 'lucide-react';
import { MetroWaterData, WATER_STANDARDS } from '../constants/metros';
import './MetroDashboard.css';

export interface HistoricalPoint {
  day: string;
  intake: number;
  usage: number;
}

interface MetroDashboardProps {
  metroData: MetroWaterData;
  historicalData: HistoricalPoint[];
}

const wastageColour = (pct: number): string => {
  if (pct < WATER_STANDARDS.NRW_TARGET) return '#16a34a';      // green
  if (pct < WATER_STANDARDS.NRW_ACCEPTABLE) return '#ea580c';  // orange
  return '#dc2626';                                            // red
};

const MetroDashboard: React.FC<MetroDashboardProps> = ({ metroData, historicalData }) => {
  const pieData = [
    { name: 'Actual usage', value: metroData.usage, color: '#10b981' },
    { name: 'Wastage (NRW)', value: metroData.wastage, color: '#ef4444' },
  ];

  return (
    <div className="metro-dashboard">
      <h2 className="dashboard-title">Water metrics &mdash; {metroData.metro}</h2>

      <div className="metrics-grid">
        <div className="metric-card blue">
          <div className="metric-content">
            <div className="metric-info">
              <p className="metric-label">Daily water intake</p>
              <p className="metric-value">{metroData.intake} <span className="unit">ML</span></p>
              <p className="metric-subtitle">Megalitres per day</p>
            </div>
            <Droplet className="metric-icon" size={48} />
          </div>
        </div>

        <div className="metric-card green">
          <div className="metric-content">
            <div className="metric-info">
              <p className="metric-label">Actual usage</p>
              <p className="metric-value">{metroData.usage} <span className="unit">ML</span></p>
              <p className="metric-subtitle">Delivered to consumers</p>
            </div>
            <CheckCircle className="metric-icon" size={48} />
          </div>
        </div>

        <div className="metric-card red">
          <div className="metric-content">
            <div className="metric-info">
              <p className="metric-label">Water wastage</p>
              <p className="metric-value">{metroData.wastage} <span className="unit">ML</span></p>
              <p
                className="metric-subtitle"
                style={{ color: wastageColour(metroData.wastagePercentage), fontWeight: 600 }}
              >
                {metroData.wastagePercentage}% Non-Revenue Water
              </p>
            </div>
            <AlertTriangle className="metric-icon" size={48} />
          </div>
        </div>

        <div className="metric-card purple">
          <div className="metric-content">
            <div className="metric-info">
              <p className="metric-label">Per-capita usage</p>
              <p className="metric-value">{metroData.perCapita} <span className="unit">L</span></p>
              <p className="metric-subtitle">Litres per person per day</p>
            </div>
            <Activity className="metric-icon" size={48} />
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3 className="chart-title">Water flow breakdown</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry: any) => `${entry.name}: ${Number(entry.value).toFixed(1)} ML`}
                outerRadius={100}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3 className="chart-title">7-day water trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={historicalData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="intake" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} name="Intake" />
              <Area type="monotone" dataKey="usage"  stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} name="Usage" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={`stress-level-card stress-${metroData.stressLevel.toLowerCase()}`}>
        <h4>Water stress level: {metroData.stressLevel}</h4>
        <p>
          {metroData.stressLevel === 'CRITICAL' && 'Immediate action required. Per-capita usage below WHO minimum.'}
          {metroData.stressLevel === 'HIGH'     && 'High stress. Per-capita usage below recommended levels.'}
          {metroData.stressLevel === 'MEDIUM'   && 'Moderate stress. Monitor closely.'}
          {metroData.stressLevel === 'LOW'      && 'Acceptable levels. Continue monitoring.'}
        </p>
        <div className="benchmark-info">
          <p>WHO recommended: {WATER_STANDARDS.WHO_MIN_RECOMMENDED}–{WATER_STANDARDS.WHO_MAX_RECOMMENDED} L/person/day</p>
          <p>Current NRW: {metroData.wastagePercentage}% (target: &lt;{WATER_STANDARDS.NRW_TARGET}%)</p>
        </div>
      </div>
    </div>
  );
};

export default MetroDashboard;
