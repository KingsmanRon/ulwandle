import React, { useState, useEffect } from 'react';
import { apiService, PredictionSummary } from '../services/apiService';

const Predictions: React.FC = () => {
  const [predictions, setPredictions] = useState<PredictionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPredictions();
  }, []);

  const loadPredictions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getPredictions();
      setPredictions(data.predictions || []);
    } catch (error) {
      console.error('Failed to load predictions:', error);
      setError('Predictions could not be loaded. Check the API connection or try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="predictions">
      <h2>🤖 AI-Powered Predictions</h2>
      <p>Claude AI analyzes water consumption patterns and predicts future demand</p>
      {loading && <div className="monitoring-state">Loading predictions…</div>}
      {!loading && error && <div className="monitoring-state error">{error}</div>}
      {!loading && !error && predictions.length === 0 && (
        <div className="monitoring-state">No predictions are available yet.</div>
      )}
      <div className="predictions-list">
        {predictions.map((pred) => (
          <div key={pred.id} className="prediction-card">
            <h3>{pred.prediction_type}</h3>
            <p><strong>Confidence:</strong> {pred.confidence_score == null ? 'Not available' : `${(pred.confidence_score * 100).toFixed(0)}%`}</p>
            <p><strong>Horizon:</strong> {pred.prediction_horizon ?? 'Not available'}</p>
            <p><strong>Created:</strong> {new Date(pred.created_at).toLocaleString()}</p>
            {pred.summary && <p className="summary">{pred.summary}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Predictions;
