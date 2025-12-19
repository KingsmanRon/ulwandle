import React, { useState, useEffect, useRef } from 'react';
import { Metro } from '../constants/saMetros';
import { Activity, AlertTriangle, Droplets, Zap } from 'lucide-react';
import './NetworkGraph.css';

interface Intersection {
  intersection_id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  flow_rate_ml: number;
  pressure_kpa: number;
  status: string;
}

interface Connection {
  from_id: string;
  to_id: string;
  pipe_diameter_mm: number;
  pipe_length_km: number;
  pipe_material: string;
  pipe_age_years: number;
  max_flow_ml: number;
}

interface Leak {
  leak_id: string;
  segment_start_id: string;
  segment_end_id: string;
  severity: string;
  estimated_loss_ml: number;
  estimated_loss_percentage: number;
  ai_confidence: number;
  probable_cause: string;
  urgency_level: string;
  status: string;
  affected_areas: string[];
}

interface NetworkGraphProps {
  metro: Metro;
}

const NetworkGraph: React.FC<NetworkGraphProps> = ({ metro }) => {
  const [intersections, setIntersections] = useState<Intersection[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [leaks, setLeaks] = useState<Leak[]>([]);
  const [selectedIntersection, setSelectedIntersection] = useState<Intersection | null>(null);
  const [selectedLeak, setSelectedLeak] = useState<Leak | null>(null);
  const [loading, setLoading] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    fetchNetworkData();
  }, [metro.id]);

  const fetchNetworkData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/api/v1/metros/${metro.id}/network`);
      const data = await response.json();
      setIntersections(data.intersections);
      setConnections(data.connections);
      setLeaks(data.leaks);
    } catch (error) {
      console.error('Error fetching network data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getNodeColor = (intersection: Intersection): string => {
    if (intersection.status === 'CRITICAL') return '#dc2626';
    if (intersection.status === 'WARNING') return '#f59e0b';
    if (intersection.type === 'SOURCE') return '#8b5cf6';
    if (intersection.type === 'PRIMARY') return '#3b82f6';
    return '#10b981';
  };

  const getNodeSize = (intersection: Intersection): number => {
    if (intersection.type === 'SOURCE') return 20;
    if (intersection.type === 'PRIMARY') return 16;
    return 12;
  };

  const hasLeak = (fromId: string, toId: string): Leak | undefined => {
    return leaks.find(
      l => (l.segment_start_id === fromId && l.segment_end_id === toId) ||
        (l.segment_start_id === toId && l.segment_end_id === fromId)
    );
  };

  const getConnectionStroke = (connection: Connection): string => {
    const leak = hasLeak(connection.from_id, connection.to_id);
    if (leak) {
      if (leak.severity === 'CRITICAL') return '#dc2626';
      if (leak.severity === 'HIGH') return '#ea580c';
      return '#f59e0b';
    }
    return '#cbd5e1';
  };

  // Calculate positions for nodes (simplified force-directed layout)
  const calculateNodePosition = (index: number, total: number, type: string): { x: number; y: number } => {
    const width = 800;
    const height = 600;
    const centerX = width / 2;
    const centerY = height / 2;

    if (type === 'SOURCE') {
      return { x: centerX, y: 80 };
    }

    if (type === 'PRIMARY') {
      const angle = (index * 2 * Math.PI) / total;
      const radius = 150;
      return {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle) - 50,
      };
    }

    // Secondary nodes
    const angle = (index * 2 * Math.PI) / total;
    const radius = 280;
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  };

  // Build node position map
  const nodePositions = new Map<string, { x: number; y: number }>();
  let primaryIndex = 0;
  let secondaryIndex = 0;
  const primaryCount = intersections.filter(i => i.type === 'PRIMARY').length;
  const secondaryCount = intersections.filter(i => i.type === 'SECONDARY').length;

  intersections.forEach(intersection => {
    if (intersection.type === 'SOURCE') {
      nodePositions.set(intersection.intersection_id, calculateNodePosition(0, 1, 'SOURCE'));
    } else if (intersection.type === 'PRIMARY') {
      nodePositions.set(intersection.intersection_id, calculateNodePosition(primaryIndex++, primaryCount, 'PRIMARY'));
    } else {
      nodePositions.set(intersection.intersection_id, calculateNodePosition(secondaryIndex++, secondaryCount, 'SECONDARY'));
    }
  });

  if (loading) {
    return (
      <div className="network-graph loading">
        <Activity className="spinner" size={32} />
        <p>Loading network topology...</p>
      </div>
    );
  }

  const criticalLeaks = leaks.filter(l => l.severity === 'CRITICAL' || l.severity === 'HIGH');

  return (
    <div className="network-graph-container">
      <div className="network-header">
        <h3>
          <Zap size={24} />
          {metro.name} - Water Distribution Network
        </h3>
        <div className="network-stats">
          <span className="stat">
            <strong>{intersections.length}</strong> Nodes
          </span>
          <span className="stat">
            <strong>{connections.length}</strong> Pipes
          </span>
          <span className="stat critical">
            <AlertTriangle size={16} />
            <strong>{criticalLeaks.length}</strong> Critical Leaks
          </span>
        </div>
      </div>

      <div className="network-content">
        <svg
          ref={svgRef}
          className="network-svg"
          viewBox="0 0 800 600"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Background */}
          <rect width="800" height="600" fill="#f8fafc" />

          {/* Grid */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="800" height="600" fill="url(#grid)" />

          {/* Connections (pipes) */}
          <g className="connections">
            {connections.map((connection, idx) => {
              const fromPos = nodePositions.get(connection.from_id);
              const toPos = nodePositions.get(connection.to_id);
              const leak = hasLeak(connection.from_id, connection.to_id);

              if (!fromPos || !toPos) return null;

              return (
                <g key={idx}>
                  <line
                    x1={fromPos.x}
                    y1={fromPos.y}
                    x2={toPos.x}
                    y2={toPos.y}
                    stroke={getConnectionStroke(connection)}
                    strokeWidth={leak ? 4 : 2}
                    strokeDasharray={leak ? '5,5' : 'none'}
                    className={`connection-line ${leak ? 'has-leak' : ''}`}
                    onClick={() => leak && setSelectedLeak(leak)}
                    style={{ cursor: leak ? 'pointer' : 'default' }}
                  />

                  {leak && (
                    <g>
                      {/* Leak indicator */}
                      <circle
                        cx={(fromPos.x + toPos.x) / 2}
                        cy={(fromPos.y + toPos.y) / 2}
                        r="8"
                        fill={getConnectionStroke(connection)}
                        className="leak-indicator"
                        onClick={() => setSelectedLeak(leak)}
                        style={{ cursor: 'pointer' }}
                      />
                      <text
                        x={(fromPos.x + toPos.x) / 2}
                        y={(fromPos.y + toPos.y) / 2 + 3}
                        textAnchor="middle"
                        fill="white"
                        fontSize="10"
                        fontWeight="bold"
                        pointerEvents="none"
                      >
                        !
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          {/* Nodes (intersections) */}
          <g className="nodes">
            {intersections.map(intersection => {
              const pos = nodePositions.get(intersection.intersection_id);
              if (!pos) return null;

              const isSelected = selectedIntersection?.intersection_id === intersection.intersection_id;

              return (
                <g key={intersection.intersection_id}>
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={getNodeSize(intersection) + (isSelected ? 4 : 0)}
                    fill={getNodeColor(intersection)}
                    stroke={isSelected ? '#1e40af' : 'white'}
                    strokeWidth={isSelected ? 3 : 2}
                    className={`node ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedIntersection(intersection)}
                    style={{ cursor: 'pointer' }}
                  />

                  {/* Node label */}
                  <text
                    x={pos.x}
                    y={pos.y + getNodeSize(intersection) + 15}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#1f2937"
                    className="node-label"
                    pointerEvents="none"
                  >
                    {intersection.type === 'SOURCE' ? 'SOURCE' : intersection.name.split(' ').pop()}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Info panel */}
        <div className="network-info-panel">
          {selectedLeak ? (
            <div className="leak-info-panel">
              <div className="info-header">
                <h4>
                  <AlertTriangle size={20} />
                  Leak Detection
                </h4>
                <span
                  className="severity-badge"
                  style={{
                    backgroundColor:
                      selectedLeak.severity === 'CRITICAL' ? '#dc2626' :
                        selectedLeak.severity === 'HIGH' ? '#ea580c' : '#f59e0b'
                  }}
                >
                  {selectedLeak.severity}
                </span>
              </div>

              <div className="info-details">
                <p><strong>Leak ID:</strong> {selectedLeak.leak_id}</p>
                <p><strong>Estimated Loss:</strong> {selectedLeak.estimated_loss_ml.toFixed(1)} ML/day</p>
                <p><strong>Loss Percentage:</strong> {selectedLeak.estimated_loss_percentage.toFixed(1)}%</p>
                <p><strong>AI Confidence:</strong> {selectedLeak.ai_confidence.toFixed(0)}%</p>
                <p><strong>Probable Cause:</strong> {selectedLeak.probable_cause}</p>
                <p><strong>Urgency:</strong> {selectedLeak.urgency_level}</p>
                <p><strong>Daily Cost:</strong> ~R{(selectedLeak.estimated_loss_ml * 400).toLocaleString()}</p>
              </div>

              <button className="close-btn" onClick={() => setSelectedLeak(null)}>Close</button>
            </div>
          ) : selectedIntersection ? (
            <div className="intersection-info-panel">
              <div className="info-header">
                <h4>
                  <Droplets size={20} />
                  Intersection Details
                </h4>
                <span className="type-badge">{selectedIntersection.type}</span>
              </div>

              <div className="info-details">
                <p><strong>Name:</strong> {selectedIntersection.name}</p>
                <p><strong>Flow Rate:</strong> {selectedIntersection.flow_rate_ml.toFixed(1)} ML/day</p>
                <p><strong>Pressure:</strong> {selectedIntersection.pressure_kpa.toFixed(0)} kPa</p>
                <p><strong>Status:</strong> <span className={`status-${selectedIntersection.status.toLowerCase()}`}>{selectedIntersection.status}</span></p>
              </div>

              <button className="close-btn" onClick={() => setSelectedIntersection(null)}>Close</button>
            </div>
          ) : (
            <div className="network-legend">
              <h4>Legend</h4>
              <div className="legend-items">
                <div className="legend-item">
                  <div className="legend-node" style={{ backgroundColor: '#8b5cf6', width: '20px', height: '20px' }}></div>
                  <span>Source (Treatment Plant)</span>
                </div>
                <div className="legend-item">
                  <div className="legend-node" style={{ backgroundColor: '#3b82f6', width: '16px', height: '16px' }}></div>
                  <span>Primary Distribution</span>
                </div>
                <div className="legend-item">
                  <div className="legend-node" style={{ backgroundColor: '#10b981', width: '12px', height: '12px' }}></div>
                  <span>Secondary Distribution</span>
                </div>
                <div className="legend-item">
                  <div className="legend-line leak"></div>
                  <span>Pipe with Leak</span>
                </div>
                <div className="legend-item">
                  <div className="legend-line normal"></div>
                  <span>Normal Pipe</span>
                </div>
              </div>
              <p className="legend-hint">💡 Click on nodes or leak indicators for details</p>
            </div>
          )}
        </div>
      </div>

      {/* Critical leaks summary */}
      {criticalLeaks.length > 0 && (
        <div className="critical-leaks-summary">
          <h4>
            <AlertTriangle size={20} />
            Critical Leaks Requiring Immediate Attention
          </h4>
          <div className="critical-leaks-list">
            {criticalLeaks.slice(0, 3).map(leak => (
              <div key={leak.leak_id} className="critical-leak-item" onClick={() => setSelectedLeak(leak)}>
                <div className="leak-severity-indicator" style={{
                  backgroundColor: leak.severity === 'CRITICAL' ? '#dc2626' : '#ea580c'
                }}></div>
                <div className="leak-summary">
                  <strong>{leak.leak_id}</strong>
                  <span>{leak.probable_cause} - {leak.estimated_loss_ml.toFixed(1)} ML/day loss</span>
                </div>
                <div className="leak-cost">R{(leak.estimated_loss_ml * 400).toLocaleString()}/day</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkGraph;
