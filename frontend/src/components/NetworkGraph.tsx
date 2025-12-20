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
  const [usingFallback, setUsingFallback] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // Hardcoded fallback data for each metro when API is unavailable
  const getFallbackData = (metroId: string) => {
    const fallbackData: Record<string, { intersections: Intersection[], connections: Connection[], leaks: Leak[] }> = {
      jhb: {
        intersections: [
          { intersection_id: 'j1', name: 'Vaal Dam', type: 'SOURCE', lat: -26.8667, lng: 28.1167, flow_rate_ml: 3200, pressure_kpa: 450, status: 'NORMAL' },
          { intersection_id: 'j2', name: 'Zuikerbosch Pump Station', type: 'PUMP', lat: -26.5000, lng: 28.0000, flow_rate_ml: 3200, pressure_kpa: 420, status: 'NORMAL' },
          { intersection_id: 'j3', name: 'Vereeniging Purification', type: 'TREATMENT', lat: -26.6500, lng: 27.9500, flow_rate_ml: 3100, pressure_kpa: 400, status: 'NORMAL' },
          { intersection_id: 'j4', name: 'Eikenhof Pump', type: 'PUMP', lat: -26.3500, lng: 28.0000, flow_rate_ml: 1200, pressure_kpa: 380, status: 'NORMAL' },
          { intersection_id: 'j5', name: 'Meredale Reservoir', type: 'RESERVOIR', lat: -26.2500, lng: 27.9500, flow_rate_ml: 600, pressure_kpa: 280, status: 'WARNING' },
          { intersection_id: 'j6', name: 'Sandton Reservoir', type: 'RESERVOIR', lat: -26.1000, lng: 28.0500, flow_rate_ml: 800, pressure_kpa: 320, status: 'NORMAL' },
        ],
        connections: [
          { from_id: 'j1', to_id: 'j2', pipe_diameter_mm: 1200, pipe_length_km: 45, pipe_material: 'Steel', pipe_age_years: 15, max_flow_ml: 3500 },
          { from_id: 'j2', to_id: 'j3', pipe_diameter_mm: 1200, pipe_length_km: 12, pipe_material: 'Steel', pipe_age_years: 15, max_flow_ml: 3500 },
          { from_id: 'j3', to_id: 'j4', pipe_diameter_mm: 800, pipe_length_km: 25, pipe_material: 'Steel', pipe_age_years: 20, max_flow_ml: 1500 },
          { from_id: 'j3', to_id: 'j6', pipe_diameter_mm: 900, pipe_length_km: 30, pipe_material: 'Steel', pipe_age_years: 18, max_flow_ml: 1800 },
          { from_id: 'j4', to_id: 'j5', pipe_diameter_mm: 600, pipe_length_km: 15, pipe_material: 'Cast Iron', pipe_age_years: 35, max_flow_ml: 800 },
        ],
        leaks: [
          { leak_id: 'L-JHB-001', segment_start_id: 'j4', segment_end_id: 'j5', severity: 'CRITICAL', estimated_loss_ml: 45.5, estimated_loss_percentage: 7.6, ai_confidence: 92, probable_cause: 'Pipe corrosion - aged infrastructure', urgency_level: 'HIGH', status: 'ACTIVE', affected_areas: ['Meredale', 'South Hills'] }
        ]
      },
      cpt: {
        intersections: [
          { intersection_id: 'c1', name: 'Theewaterskloof Dam', type: 'SOURCE', lat: -34.0500, lng: 19.2500, flow_rate_ml: 450, pressure_kpa: 480, status: 'WARNING' },
          { intersection_id: 'c2', name: 'Berg River Dam', type: 'SOURCE', lat: -33.4000, lng: 19.0000, flow_rate_ml: 380, pressure_kpa: 470, status: 'NORMAL' },
          { intersection_id: 'c3', name: 'Faure WTW', type: 'TREATMENT', lat: -34.0000, lng: 18.7000, flow_rate_ml: 800, pressure_kpa: 420, status: 'NORMAL' },
          { intersection_id: 'c4', name: 'Muldersvlei Pump', type: 'PUMP', lat: -33.9500, lng: 18.6500, flow_rate_ml: 500, pressure_kpa: 390, status: 'NORMAL' },
          { intersection_id: 'c5', name: 'Blackheath Reservoir', type: 'RESERVOIR', lat: -33.9700, lng: 18.5800, flow_rate_ml: 300, pressure_kpa: 310, status: 'NORMAL' },
        ],
        connections: [
          { from_id: 'c1', to_id: 'c3', pipe_diameter_mm: 1000, pipe_length_km: 70, pipe_material: 'Steel', pipe_age_years: 25, max_flow_ml: 500 },
          { from_id: 'c2', to_id: 'c3', pipe_diameter_mm: 900, pipe_length_km: 55, pipe_material: 'Steel', pipe_age_years: 22, max_flow_ml: 400 },
          { from_id: 'c3', to_id: 'c4', pipe_diameter_mm: 800, pipe_length_km: 15, pipe_material: 'Steel', pipe_age_years: 20, max_flow_ml: 600 },
          { from_id: 'c4', to_id: 'c5', pipe_diameter_mm: 600, pipe_length_km: 12, pipe_material: 'Steel', pipe_age_years: 18, max_flow_ml: 350 },
        ],
        leaks: []
      },
      eth: {
        intersections: [
          { intersection_id: 'e1', name: 'Midmar Dam', type: 'SOURCE', lat: -29.4500, lng: 30.1500, flow_rate_ml: 280, pressure_kpa: 460, status: 'NORMAL' },
          { intersection_id: 'e2', name: 'Albert Falls', type: 'SOURCE', lat: -29.5000, lng: 30.3500, flow_rate_ml: 320, pressure_kpa: 465, status: 'NORMAL' },
          { intersection_id: 'e3', name: 'Nagle Dam', type: 'SOURCE', lat: -29.7000, lng: 30.7000, flow_rate_ml: 260, pressure_kpa: 455, status: 'NORMAL' },
          { intersection_id: 'e4', name: 'Durban Heights WTW', type: 'TREATMENT', lat: -29.8200, lng: 30.9500, flow_rate_ml: 850, pressure_kpa: 410, status: 'MAINTENANCE' },
          { intersection_id: 'e5', name: 'Northdene Reservoir', type: 'RESERVOIR', lat: -29.9500, lng: 30.8500, flow_rate_ml: 150, pressure_kpa: 180, status: 'CRITICAL' },
          { intersection_id: 'e6', name: 'Umlazi Reservoir', type: 'RESERVOIR', lat: -29.9800, lng: 30.8800, flow_rate_ml: 200, pressure_kpa: 320, status: 'NORMAL' },
        ],
        connections: [
          { from_id: 'e1', to_id: 'e3', pipe_diameter_mm: 800, pipe_length_km: 35, pipe_material: 'Steel', pipe_age_years: 30, max_flow_ml: 300 },
          { from_id: 'e2', to_id: 'e3', pipe_diameter_mm: 800, pipe_length_km: 40, pipe_material: 'Steel', pipe_age_years: 28, max_flow_ml: 350 },
          { from_id: 'e3', to_id: 'e4', pipe_diameter_mm: 1000, pipe_length_km: 25, pipe_material: 'Steel', pipe_age_years: 22, max_flow_ml: 900 },
          { from_id: 'e4', to_id: 'e5', pipe_diameter_mm: 500, pipe_length_km: 18, pipe_material: 'Cast Iron', pipe_age_years: 42, max_flow_ml: 200 },
          { from_id: 'e4', to_id: 'e6', pipe_diameter_mm: 600, pipe_length_km: 15, pipe_material: 'Steel', pipe_age_years: 25, max_flow_ml: 250 },
        ],
        leaks: [
          { leak_id: 'L-ETH-001', segment_start_id: 'e4', segment_end_id: 'e5', severity: 'CRITICAL', estimated_loss_ml: 38.2, estimated_loss_percentage: 25.5, ai_confidence: 95, probable_cause: 'Burst pipe - aged cast iron', urgency_level: 'CRITICAL', status: 'ACTIVE', affected_areas: ['Northdene', 'Chatsworth'] }
        ]
      },
      tsh: {
        intersections: [
          { intersection_id: 't1', name: 'Rietvlei Dam', type: 'SOURCE', lat: -25.8800, lng: 28.3500, flow_rate_ml: 240, pressure_kpa: 445, status: 'NORMAL' },
          { intersection_id: 't2', name: 'Roodeplaat Dam', type: 'SOURCE', lat: -25.6000, lng: 28.3500, flow_rate_ml: 260, pressure_kpa: 450, status: 'WARNING' },
          { intersection_id: 't3', name: 'Rietvlei WTW', type: 'TREATMENT', lat: -25.8500, lng: 28.3200, flow_rate_ml: 235, pressure_kpa: 410, status: 'NORMAL' },
          { intersection_id: 't4', name: 'Temba WTW', type: 'TREATMENT', lat: -25.5500, lng: 28.2500, flow_rate_ml: 180, pressure_kpa: 395, status: 'WARNING' },
          { intersection_id: 't5', name: 'Garsfontein Reservoir', type: 'RESERVOIR', lat: -25.7800, lng: 28.2800, flow_rate_ml: 600, pressure_kpa: 330, status: 'NORMAL' },
        ],
        connections: [
          { from_id: 't1', to_id: 't3', pipe_diameter_mm: 700, pipe_length_km: 8, pipe_material: 'Steel', pipe_age_years: 28, max_flow_ml: 250 },
          { from_id: 't2', to_id: 't4', pipe_diameter_mm: 700, pipe_length_km: 12, pipe_material: 'Steel', pipe_age_years: 25, max_flow_ml: 280 },
          { from_id: 't3', to_id: 't5', pipe_diameter_mm: 800, pipe_length_km: 15, pipe_material: 'Steel', pipe_age_years: 22, max_flow_ml: 650 },
          { from_id: 't4', to_id: 't5', pipe_diameter_mm: 600, pipe_length_km: 20, pipe_material: 'Steel', pipe_age_years: 30, max_flow_ml: 200 },
        ],
        leaks: []
      },
      nmb: {
        intersections: [
          { intersection_id: 'n1', name: 'Kouga Dam', type: 'SOURCE', lat: -33.7500, lng: 24.6500, flow_rate_ml: 95, pressure_kpa: 320, status: 'CRITICAL' },
          { intersection_id: 'n2', name: 'Impofu Dam', type: 'SOURCE', lat: -33.8000, lng: 24.8500, flow_rate_ml: 85, pressure_kpa: 310, status: 'CRITICAL' },
          { intersection_id: 'n3', name: 'Nooitgedacht WTW', type: 'TREATMENT', lat: -33.9500, lng: 25.5000, flow_rate_ml: 175, pressure_kpa: 385, status: 'NORMAL' },
          { intersection_id: 'n4', name: 'Chelsea Reservoir', type: 'RESERVOIR', lat: -33.9900, lng: 25.5800, flow_rate_ml: 350, pressure_kpa: 290, status: 'WARNING' },
        ],
        connections: [
          { from_id: 'n1', to_id: 'n3', pipe_diameter_mm: 600, pipe_length_km: 88, pipe_material: 'Steel', pipe_age_years: 35, max_flow_ml: 120 },
          { from_id: 'n2', to_id: 'n3', pipe_diameter_mm: 600, pipe_length_km: 75, pipe_material: 'Steel', pipe_age_years: 32, max_flow_ml: 110 },
          { from_id: 'n3', to_id: 'n4', pipe_diameter_mm: 700, pipe_length_km: 12, pipe_material: 'Steel', pipe_age_years: 28, max_flow_ml: 400 },
        ],
        leaks: []
      },
      eku: {
        intersections: [
          { intersection_id: 'ek1', name: 'Vaal System', type: 'SOURCE', lat: -26.8500, lng: 28.4000, flow_rate_ml: 2800, pressure_kpa: 455, status: 'NORMAL' },
          { intersection_id: 'ek2', name: 'Mapleton Pump Station', type: 'PUMP', lat: -26.3000, lng: 28.3500, flow_rate_ml: 2100, pressure_kpa: 420, status: 'NORMAL' },
          { intersection_id: 'ek3', name: 'Vlakfontein Reservoir', type: 'RESERVOIR', lat: -26.2200, lng: 28.2800, flow_rate_ml: 200, pressure_kpa: 310, status: 'NORMAL' },
          { intersection_id: 'ek4', name: 'Brakpan Reservoir', type: 'RESERVOIR', lat: -26.2400, lng: 28.3700, flow_rate_ml: 150, pressure_kpa: 280, status: 'WARNING' },
        ],
        connections: [
          { from_id: 'ek1', to_id: 'ek2', pipe_diameter_mm: 1200, pipe_length_km: 55, pipe_material: 'Steel', pipe_age_years: 18, max_flow_ml: 3000 },
          { from_id: 'ek2', to_id: 'ek3', pipe_diameter_mm: 600, pipe_length_km: 18, pipe_material: 'Steel', pipe_age_years: 22, max_flow_ml: 250 },
          { from_id: 'ek2', to_id: 'ek4', pipe_diameter_mm: 550, pipe_length_km: 15, pipe_material: 'Steel', pipe_age_years: 25, max_flow_ml: 200 },
        ],
        leaks: []
      },
      man: {
        intersections: [
          { intersection_id: 'm1', name: 'Rustfontein Dam', type: 'SOURCE', lat: -29.1500, lng: 26.1500, flow_rate_ml: 180, pressure_kpa: 430, status: 'NORMAL' },
          { intersection_id: 'm2', name: 'Gariep Dam', type: 'SOURCE', lat: -30.6200, lng: 25.5200, flow_rate_ml: 220, pressure_kpa: 440, status: 'NORMAL' },
          { intersection_id: 'm3', name: 'Maselspoort WTW', type: 'TREATMENT', lat: -29.1000, lng: 26.2000, flow_rate_ml: 385, pressure_kpa: 400, status: 'NORMAL' },
          { intersection_id: 'm4', name: 'Brandkop Reservoir', type: 'RESERVOIR', lat: -29.1200, lng: 26.2200, flow_rate_ml: 200, pressure_kpa: 325, status: 'NORMAL' },
        ],
        connections: [
          { from_id: 'm1', to_id: 'm3', pipe_diameter_mm: 600, pipe_length_km: 8, pipe_material: 'Steel', pipe_age_years: 24, max_flow_ml: 200 },
          { from_id: 'm2', to_id: 'm3', pipe_diameter_mm: 700, pipe_length_km: 165, pipe_material: 'Steel', pipe_age_years: 28, max_flow_ml: 250 },
          { from_id: 'm3', to_id: 'm4', pipe_diameter_mm: 600, pipe_length_km: 5, pipe_material: 'Steel', pipe_age_years: 22, max_flow_ml: 250 },
        ],
        leaks: []
      },
      bcm: {
        intersections: [
          { intersection_id: 'b1', name: 'Bridle Drift Dam', type: 'SOURCE', lat: -32.8500, lng: 27.6500, flow_rate_ml: 165, pressure_kpa: 435, status: 'NORMAL' },
          { intersection_id: 'b2', name: 'Nahoon Dam', type: 'SOURCE', lat: -32.9500, lng: 27.9500, flow_rate_ml: 145, pressure_kpa: 430, status: 'NORMAL' },
          { intersection_id: 'b3', name: 'Umzonyana WTW', type: 'TREATMENT', lat: -32.9600, lng: 27.8000, flow_rate_ml: 295, pressure_kpa: 400, status: 'NORMAL' },
          { intersection_id: 'b4', name: 'Dawn Reservoir', type: 'RESERVOIR', lat: -32.9800, lng: 27.8200, flow_rate_ml: 100, pressure_kpa: 310, status: 'NORMAL' },
        ],
        connections: [
          { from_id: 'b1', to_id: 'b3', pipe_diameter_mm: 550, pipe_length_km: 22, pipe_material: 'Steel', pipe_age_years: 26, max_flow_ml: 180 },
          { from_id: 'b3', to_id: 'b4', pipe_diameter_mm: 500, pipe_length_km: 8, pipe_material: 'Steel', pipe_age_years: 24, max_flow_ml: 150 },
        ],
        leaks: []
      }
    };

    return fallbackData[metroId] || { intersections: [], connections: [], leaks: [] };
  };

  useEffect(() => {
    fetchNetworkData();
  }, [metro.id]);

  const fetchNetworkData = async () => {
    setLoading(true);
    setUsingFallback(false);
    try {
      const response = await fetch(`http://localhost:8000/api/v1/metros/${metro.id}/network`);

      if (!response.ok) {
        throw new Error('API unavailable');
      }

      const data = await response.json();
      setIntersections(data.intersections);
      setConnections(data.connections);
      setLeaks(data.leaks);
    } catch (error) {
      console.log('API unavailable, using fallback data for visualization');
      const fallback = getFallbackData(metro.id);
      setIntersections(fallback.intersections);
      setConnections(fallback.connections);
      setLeaks(fallback.leaks);
      setUsingFallback(true);
    } finally {
      setLoading(false);
    }
  };

  const getNodeColor = (intersection: Intersection): string => {
    // Status-based colors (priority)
    if (intersection.status === 'CRITICAL') return '#dc2626';
    if (intersection.status === 'WARNING') return '#f59e0b';
    if (intersection.status === 'MAINTENANCE') return '#64748b';

    // Infrastructure type colors
    if (intersection.type === 'SOURCE') return '#8b5cf6';
    if (intersection.type === 'TREATMENT') return '#06b6d4';
    if (intersection.type === 'PUMP') return '#f97316';
    if (intersection.type === 'RESERVOIR') return '#3b82f6';
    if (intersection.type === 'PRIMARY') return '#3b82f6';

    return '#10b981';
  };

  const getNodeSize = (intersection: Intersection): number => {
    if (intersection.type === 'SOURCE') return 20;
    if (intersection.type === 'TREATMENT') return 18;
    if (intersection.type === 'PRIMARY') return 16;
    if (intersection.type === 'PUMP') return 14;
    if (intersection.type === 'RESERVOIR') return 16;
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
        <div>
          <h3>
            <Zap size={24} />
            {metro.name} - Water Distribution Network
          </h3>
          {usingFallback && (
            <p style={{
              margin: '0.25rem 0 0 0',
              fontSize: '0.75rem',
              color: '#92400e',
              fontWeight: '500'
            }}>
              ⚠️ Offline Mode - Showing infrastructure visualization
            </p>
          )}
        </div>
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
              {usingFallback && (
                <div style={{
                  background: '#fef3c7',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  color: '#92400e',
                  marginBottom: '1rem'
                }}>
                  ⚠️ Using offline data - API unavailable
                </div>
              )}
              <div className="legend-items">
                <div className="legend-item">
                  <div className="legend-node" style={{ backgroundColor: '#8b5cf6', width: '20px', height: '20px' }}></div>
                  <span>Water Source / Dam</span>
                </div>
                <div className="legend-item">
                  <div className="legend-node" style={{ backgroundColor: '#06b6d4', width: '18px', height: '18px' }}></div>
                  <span>Treatment Plant (WTW)</span>
                </div>
                <div className="legend-item">
                  <div className="legend-node" style={{ backgroundColor: '#f97316', width: '14px', height: '14px' }}></div>
                  <span>Pump Station</span>
                </div>
                <div className="legend-item">
                  <div className="legend-node" style={{ backgroundColor: '#3b82f6', width: '16px', height: '16px' }}></div>
                  <span>Reservoir / Storage</span>
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
