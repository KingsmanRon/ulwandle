import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

const KillSwitch: React.FC = () => {
  const [valves, setValves] = useState<any[]>([]);

  useEffect(() => {
    loadValves();
  }, []);

  const loadValves = async () => {
    try {
      const data = await apiService.getValves();
      setValves(data.valves || []);
    } catch (error) {
      console.error('Failed to load valves:', error);
    }
  };

  return (
    <div className="kill-switch">
      <h2>🔴 Kill Switch - Remote Valve Control</h2>
      <div className="warning-banner">
        <strong>⚠️ WARNING:</strong> Valve operations affect water supply. Use with caution.
      </div>
      <div className="valves-grid">
        {valves.map((valve) => (
          <div key={valve.id} className="valve-card">
            <h3>{valve.name}</h3>
            <p><strong>ID:</strong> {valve.valve_id}</p>
            <p><strong>Location:</strong> {valve.location_name}</p>
            <div className={`valve-status ${valve.status}`}>
              Status: {valve.status.toUpperCase()}
            </div>
            <p><small>Last operated: {valve.last_operated_at ? new Date(valve.last_operated_at).toLocaleString() : 'Never'}</small></p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KillSwitch;
