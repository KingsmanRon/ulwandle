import React from 'react';
import { Bot, Activity, CheckCircle } from 'lucide-react';
import './ClaudeRecommendations.css';

export interface Recommendation {
  title: string;
  description: string;
  impact: string;
  cost: string;
  timeline: string;
  kpis: string[];
}

export interface ClaudeRecommendationsData {
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  recommendations: Recommendation[];
  potentialSavings: string;
  roi: string;
}

interface ClaudeRecommendationsPanelProps {
  recommendations: ClaudeRecommendationsData | null;
  loading: boolean;
  onRefresh: () => void;
}

const ClaudeRecommendationsPanel: React.FC<ClaudeRecommendationsPanelProps> = ({
  recommendations,
  loading,
  onRefresh
}) => {
  if (loading) {
    return (
      <div className="claude-recommendations loading">
        <div className="loading-content">
          <Activity className="spinner" size={24} />
          <p>Claude is analyzing water data and generating recommendations...</p>
        </div>
      </div>
    );
  }

  if (!recommendations) return null;

  const priorityClass = `priority-${recommendations.priority.toLowerCase()}`;

  return (
    <div className="claude-recommendations">
      <div className="recommendations-header">
        <div className="header-title">
          <Bot className="bot-icon" size={32} />
          <div>
            <h3>Claude AI Water Conservation Advisor</h3>
            <p className="subtitle">Powered by Anthropic Claude Sonnet 4</p>
          </div>
        </div>
        <button onClick={onRefresh} className="refresh-button">
          <Activity size={18} />
          Refresh Analysis
        </button>
      </div>

      <div className={`priority-banner ${priorityClass}`}>
        <p className="priority-level">Priority Level: {recommendations.priority}</p>
        <p className="potential-savings">Potential Savings: {recommendations.potentialSavings}</p>
        <p className="roi-info">ROI: {recommendations.roi}</p>
      </div>

      <div className="recommendations-list">
        {recommendations.recommendations.map((rec, idx) => (
          <div key={idx} className="recommendation-card">
            <div className="recommendation-content">
              <h4 className="recommendation-title">
                {idx + 1}. {rec.title}
              </h4>
              <p className="recommendation-description">{rec.description}</p>

              <div className="recommendation-metrics">
                <div className="metric">
                  <p className="metric-label">Expected Impact</p>
                  <p className="metric-value impact">{rec.impact}</p>
                </div>
                <div className="metric">
                  <p className="metric-label">Cost Range</p>
                  <p className="metric-value cost">{rec.cost}</p>
                </div>
                <div className="metric">
                  <p className="metric-label">Timeline</p>
                  <p className="metric-value timeline">{rec.timeline}</p>
                </div>
              </div>

              <div className="kpis">
                <p className="kpis-label">Key Performance Indicators:</p>
                <ul className="kpis-list">
                  {rec.kpis.map((kpi, kpiIdx) => (
                    <li key={kpiIdx} className="kpi-item">
                      <CheckCircle className="kpi-icon" size={14} />
                      {kpi}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClaudeRecommendationsPanel;
