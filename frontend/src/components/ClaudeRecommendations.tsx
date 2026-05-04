import React from 'react';
import { Bot, Activity, CheckCircle, AlertTriangle } from 'lucide-react';
import type { RecommendationsResponse } from '../services/apiService';
import './ClaudeRecommendations.css';

// Re-exported from apiService for legacy callers; new code should
// import RecommendationsResponse directly.
export type ClaudeRecommendationsData = RecommendationsResponse;

interface ClaudeRecommendationsPanelProps {
  recommendations: RecommendationsResponse | null;
  loading: boolean;
  onRefresh: () => void;
}

const priorityToClass = (p?: string): string =>
  `priority-${(p || 'medium').toLowerCase()}`;

const ClaudeRecommendationsPanel: React.FC<ClaudeRecommendationsPanelProps> = ({
  recommendations,
  loading,
  onRefresh,
}) => {
  if (loading) {
    return (
      <div className="claude-recommendations loading">
        <div className="loading-content">
          <Activity className="spinner" size={24} />
          <p>Analysing water data and generating recommendations…</p>
        </div>
      </div>
    );
  }

  if (!recommendations) {
    return (
      <div className="claude-recommendations">
        <div className="recommendations-header">
          <div className="header-title">
            <Bot className="bot-icon" size={32} />
            <div>
              <h3>AI water-conservation advisor</h3>
              <p className="subtitle">Select a metro to generate recommendations</p>
            </div>
          </div>
          <button onClick={onRefresh} className="refresh-button" type="button">
            <Activity size={18} />
            Generate
          </button>
        </div>
      </div>
    );
  }

  // Degraded state: Anthropic unreachable / out of credit / rate-limited.
  // Show structural fallback with an honest banner.
  if (recommendations.status === 'unavailable') {
    return (
      <div className="claude-recommendations">
        <div className="recommendations-header">
          <div className="header-title">
            <Bot className="bot-icon" size={32} />
            <div>
              <h3>AI water-conservation advisor</h3>
              <p className="subtitle">Powered by Anthropic Claude · currently unavailable</p>
            </div>
          </div>
          <button onClick={onRefresh} className="refresh-button" type="button">
            <Activity size={18} />
            Retry
          </button>
        </div>
        <div className="priority-banner priority-medium">
          <p className="priority-level" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={16} />
            {recommendations.reason || 'AI advisor temporarily unavailable'}
          </p>
          <p className="roi-info">
            Showing reference recommendations from the offline playbook below.
            Live AI generation will resume automatically when the service is restored.
          </p>
        </div>
        {recommendations.recommendations && recommendations.recommendations.length > 0 && (
          <RecommendationList items={recommendations.recommendations} />
        )}
      </div>
    );
  }

  const priorityClass = priorityToClass(recommendations.priority);
  const generatedAt = recommendations.generated_at
    ? new Date(recommendations.generated_at).toLocaleString()
    : null;

  return (
    <div className="claude-recommendations">
      <div className="recommendations-header">
        <div className="header-title">
          <Bot className="bot-icon" size={32} />
          <div>
            <h3>AI water-conservation advisor</h3>
            <p className="subtitle">
              Powered by Anthropic Claude
              {generatedAt && <> · generated {generatedAt}</>}
            </p>
          </div>
        </div>
        <button onClick={onRefresh} className="refresh-button" type="button">
          <Activity size={18} />
          Refresh analysis
        </button>
      </div>

      <div className={`priority-banner ${priorityClass}`}>
        {recommendations.priority && (
          <p className="priority-level">Priority level: {recommendations.priority}</p>
        )}
        {recommendations.potential_savings && (
          <p className="potential-savings">Potential savings: {recommendations.potential_savings}</p>
        )}
        {recommendations.roi && (
          <p className="roi-info">ROI: {recommendations.roi}</p>
        )}
      </div>

      {recommendations.recommendations && recommendations.recommendations.length > 0 && (
        <RecommendationList items={recommendations.recommendations} />
      )}
    </div>
  );
};

interface ListProps {
  items: NonNullable<RecommendationsResponse['recommendations']>;
}

const RecommendationList: React.FC<ListProps> = ({ items }) => (
  <div className="recommendations-list">
    {items.map((rec, idx) => (
      <div key={idx} className="recommendation-card">
        <div className="recommendation-content">
          <h4 className="recommendation-title">
            {idx + 1}. {rec.title}
          </h4>
          <p className="recommendation-description">{rec.description}</p>

          <div className="recommendation-metrics">
            <div className="metric">
              <p className="metric-label">Expected impact</p>
              <p className="metric-value impact">{rec.impact}</p>
            </div>
            <div className="metric">
              <p className="metric-label">Cost range</p>
              <p className="metric-value cost">{rec.cost}</p>
            </div>
            <div className="metric">
              <p className="metric-label">Timeline</p>
              <p className="metric-value timeline">{rec.timeline}</p>
            </div>
          </div>

          {rec.kpis && rec.kpis.length > 0 && (
            <div className="kpis">
              <p className="kpis-label">Key performance indicators:</p>
              <ul className="kpis-list">
                {rec.kpis.map((kpi, kpiIdx) => (
                  <li key={kpiIdx} className="kpi-item">
                    <CheckCircle className="kpi-icon" size={14} />
                    {kpi}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    ))}
  </div>
);

export default ClaudeRecommendationsPanel;
