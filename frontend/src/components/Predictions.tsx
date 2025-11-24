import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

const Predictions: React.FC = () => {
  const [predictions, setPredictions] = useState<any[]>([]);

  useEffect(() => {
    loadPredictions();
  }, []);

  const loadPredictions = async () => {
    try {
      const data = await apiService.getPredictions();
      setPredictions(data.predictions || []);
    } catch (error) {
      console.error('Failed to load predictions:', error);
    }
  };

  return (
    <div className="predictions">
      <h2>🤖 AI-Powered Predictions</h2>
      <p>Claude AI analyzes water consumption patterns and predicts future demand</p>
      <div className="predictions-list">
        {predictions.map((pred) => (
          <div key={pred.id} className="prediction-card">
            <h3>{pred.prediction_type}</h3>
            <p><strong>Confidence:</strong> {(pred.confidence_score * 100).toFixed(0)}%</p>
            <p><strong>Horizon:</strong> {pred.prediction_horizon}</p>
            <p><strong>Created:</strong> {new Date(pred.created_at).toLocaleString()}</p>
            {pred.summary && <p className="summary">{pred.summary}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Predictions;
