import React, { useState, useEffect } from 'react';
import {
  Droplet,
  Factory,
  Activity,
  Waves,
  AlertTriangle,
  Wrench,
  CheckCircle,
  Map as MapIcon,
  Bell,
  MessageSquare,
  Mail,
  Info,
  X,
  Zap,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import './WaterNetworkVisualization.css';

// Types for TypeScript
type NodeType = 'source' | 'treatment' | 'pump' | 'reservoir';
type NodeStatus = 'normal' | 'warning' | 'critical' | 'maintenance';

interface Node {
  id: string;
  type: NodeType;
  name: string;
  level?: number;
  capacity?: string;
  flow?: string;
  quality?: string;
  x: number;
  y: number;
  status: NodeStatus;
}

interface Connection {
  id: string;
  from: string;
  to: string;
  status: NodeStatus;
}

interface MetroSystem {
  id: string;
  name: string;
  code: string;
  operator: string;
  nodes: Node[];
  connections: Connection[];
}

// --- Configuration: The 8 Metros (South Africa) ---
const METRO_SYSTEMS: Record<string, MetroSystem> = {
  jhb: {
    id: 'jhb',
    name: 'City of Johannesburg',
    code: 'JHB',
    operator: 'Rand Water',
    nodes: [
      { id: 'j1', type: 'source' as NodeType, name: 'Vaal Dam', level: 98, capacity: '100%', x: 50, y: 10, status: 'normal' as NodeStatus },
      { id: 'j2', type: 'pump' as NodeType, name: 'Zuikerbosch Stn', flow: '3200 Ml/d', x: 50, y: 30, status: 'normal' as NodeStatus },
      { id: 'j3', type: 'treatment' as NodeType, name: 'Vereeniging Purif.', quality: '99%', x: 50, y: 50, status: 'normal' as NodeStatus },
      { id: 'j4', type: 'pump' as NodeType, name: 'Eikenhof Pump', flow: '1200 Ml/d', x: 30, y: 70, status: 'normal' as NodeStatus },
      { id: 'j5', type: 'reservoir' as NodeType, name: 'Meredale Res', level: 45, capacity: '600 Ml', x: 30, y: 90, status: 'warning' as NodeStatus },
      { id: 'j6', type: 'reservoir' as NodeType, name: 'Sandton Res', level: 82, capacity: '800 Ml', x: 70, y: 90, status: 'normal' as NodeStatus },
    ],
    connections: [
      { id: 'jc1', from: 'j1', to: 'j2', status: 'normal' as NodeStatus },
      { id: 'jc2', from: 'j2', to: 'j3', status: 'normal' as NodeStatus },
      { id: 'jc3', from: 'j3', to: 'j4', status: 'normal' as NodeStatus },
      { id: 'jc4', from: 'j3', to: 'j6', status: 'normal' as NodeStatus },
      { id: 'jc5', from: 'j4', to: 'j5', status: 'critical' as NodeStatus },
    ]
  },
  cpt: {
    id: 'cpt',
    name: 'City of Cape Town',
    code: 'CPT',
    operator: 'DWS / City of CT',
    nodes: [
      { id: 'c1', type: 'source' as NodeType, name: 'Theewaterskloof', level: 102, capacity: '100%', x: 30, y: 10, status: 'warning' as NodeStatus },
      { id: 'c2', type: 'source' as NodeType, name: 'Berg River Dam', level: 95, capacity: '100%', x: 70, y: 10, status: 'normal' as NodeStatus },
      { id: 'c3', type: 'treatment' as NodeType, name: 'Faure WTW', quality: '98%', x: 50, y: 45, status: 'normal' as NodeStatus },
      { id: 'c4', type: 'pump' as NodeType, name: 'Muldersvlei', flow: '500 Ml/d', x: 50, y: 70, status: 'normal' as NodeStatus },
      { id: 'c5', type: 'reservoir' as NodeType, name: 'Blackheath', level: 60, capacity: '300 Ml', x: 50, y: 90, status: 'normal' as NodeStatus },
    ],
    connections: [
      { id: 'cc1', from: 'c1', to: 'c3', status: 'normal' as NodeStatus },
      { id: 'cc2', from: 'c2', to: 'c3', status: 'normal' as NodeStatus },
      { id: 'cc3', from: 'c3', to: 'c4', status: 'normal' as NodeStatus },
      { id: 'cc4', from: 'c4', to: 'c5', status: 'normal' as NodeStatus },
    ]
  },
  eth: {
    id: 'eth',
    name: 'eThekwini (Durban)',
    code: 'ETH',
    operator: 'Umgeni Water',
    nodes: [
      { id: 'e1', type: 'source' as NodeType, name: 'Midmar Dam', level: 88, capacity: '100%', x: 25, y: 10, status: 'normal' as NodeStatus },
      { id: 'e2', type: 'source' as NodeType, name: 'Albert Falls', level: 92, capacity: '100%', x: 75, y: 10, status: 'normal' as NodeStatus },
      { id: 'e3', type: 'source' as NodeType, name: 'Nagle Dam', level: 85, capacity: '100%', x: 50, y: 30, status: 'normal' as NodeStatus },
      { id: 'e4', type: 'treatment' as NodeType, name: 'Durban Heights', quality: '97%', x: 50, y: 55, status: 'maintenance' as NodeStatus },
      { id: 'e5', type: 'reservoir' as NodeType, name: 'Northdene', level: 30, capacity: '150 Ml', x: 20, y: 85, status: 'critical' as NodeStatus },
      { id: 'e6', type: 'reservoir' as NodeType, name: 'Umlazi Res', level: 70, capacity: '200 Ml', x: 80, y: 85, status: 'normal' as NodeStatus },
    ],
    connections: [
      { id: 'ec1', from: 'e1', to: 'e3', status: 'normal' as NodeStatus },
      { id: 'ec2', from: 'e2', to: 'e3', status: 'normal' as NodeStatus },
      { id: 'ec3', from: 'e3', to: 'e4', status: 'normal' as NodeStatus },
      { id: 'ec4', from: 'e4', to: 'e5', status: 'critical' as NodeStatus },
      { id: 'ec5', from: 'e4', to: 'e6', status: 'normal' as NodeStatus },
    ]
  },
  tsh: {
    id: 'tsh',
    name: 'City of Tshwane',
    code: 'TSH',
    operator: 'Rand Water / Magalies',
    nodes: [
      { id: 't1', type: 'source' as NodeType, name: 'Rietvlei Dam', level: 99, capacity: '100%', x: 30, y: 10, status: 'normal' as NodeStatus },
      { id: 't2', type: 'source' as NodeType, name: 'Roodeplaat Dam', level: 101, capacity: '100%', x: 70, y: 10, status: 'warning' as NodeStatus },
      { id: 't3', type: 'treatment' as NodeType, name: 'Rietvlei WTW', quality: '96%', x: 30, y: 40, status: 'normal' as NodeStatus },
      { id: 't4', type: 'treatment' as NodeType, name: 'Temba WTW', quality: '92%', x: 70, y: 40, status: 'warning' as NodeStatus },
      { id: 't5', type: 'reservoir' as NodeType, name: 'Garsfontein', level: 65, capacity: '600 Ml', x: 50, y: 80, status: 'normal' as NodeStatus },
    ],
    connections: [
      { id: 'tc1', from: 't1', to: 't3', status: 'normal' as NodeStatus },
      { id: 'tc2', from: 't2', to: 't4', status: 'normal' as NodeStatus },
      { id: 'tc3', from: 't3', to: 't5', status: 'normal' as NodeStatus },
      { id: 'tc4', from: 't4', to: 't5', status: 'maintenance' as NodeStatus },
    ]
  },
  nmb: {
    id: 'nmb',
    name: 'Nelson Mandela Bay',
    code: 'NMB',
    operator: 'NMBM',
    nodes: [
      { id: 'n1', type: 'source' as NodeType, name: 'Kouga Dam', level: 18, capacity: '100%', x: 30, y: 15, status: 'critical' as NodeStatus },
      { id: 'n2', type: 'source' as NodeType, name: 'Impofu Dam', level: 14, capacity: '100%', x: 70, y: 15, status: 'critical' as NodeStatus },
      { id: 'n3', type: 'treatment' as NodeType, name: 'Nooitgedacht', quality: '98%', x: 50, y: 55, status: 'normal' as NodeStatus },
      { id: 'n4', type: 'reservoir' as NodeType, name: 'Chelsea Res', level: 40, capacity: '350 Ml', x: 50, y: 85, status: 'warning' as NodeStatus },
    ],
    connections: [
      { id: 'nc1', from: 'n1', to: 'n3', status: 'normal' as NodeStatus },
      { id: 'nc2', from: 'n2', to: 'n3', status: 'normal' as NodeStatus },
      { id: 'nc3', from: 'n3', to: 'n4', status: 'normal' as NodeStatus },
    ]
  },
  eku: {
    id: 'eku',
    name: 'City of Ekurhuleni',
    code: 'EKU',
    operator: 'Rand Water',
    nodes: [
      { id: 'ek1', type: 'source' as NodeType, name: 'Vaal System', level: 98, capacity: '100%', x: 50, y: 10, status: 'normal' as NodeStatus },
      { id: 'ek2', type: 'pump' as NodeType, name: 'Mapleton Pump', flow: '2100 Ml/d', x: 50, y: 40, status: 'normal' as NodeStatus },
      { id: 'ek3', type: 'reservoir' as NodeType, name: 'Vlakfontein', level: 55, capacity: '200 Ml', x: 30, y: 80, status: 'normal' as NodeStatus },
      { id: 'ek4', type: 'reservoir' as NodeType, name: 'Brakpan Res', level: 45, capacity: '150 Ml', x: 70, y: 80, status: 'warning' as NodeStatus },
    ],
    connections: [
      { id: 'ekc1', from: 'ek1', to: 'ek2', status: 'normal' as NodeStatus },
      { id: 'ekc2', from: 'ek2', to: 'ek3', status: 'normal' as NodeStatus },
      { id: 'ekc3', from: 'ek2', to: 'ek4', status: 'normal' as NodeStatus },
    ]
  },
  man: {
    id: 'man',
    name: 'Mangaung',
    code: 'MAN',
    operator: 'Bloem Water',
    nodes: [
      { id: 'm1', type: 'source' as NodeType, name: 'Rustfontein', level: 85, capacity: '100%', x: 30, y: 20, status: 'normal' as NodeStatus },
      { id: 'm2', type: 'source' as NodeType, name: 'Gariep Dam', level: 95, capacity: '100%', x: 70, y: 20, status: 'normal' as NodeStatus },
      { id: 'm3', type: 'treatment' as NodeType, name: 'Maselspoort', quality: '95%', x: 50, y: 55, status: 'normal' as NodeStatus },
      { id: 'm4', type: 'reservoir' as NodeType, name: 'Brandkop Res', level: 75, capacity: '200 Ml', x: 50, y: 85, status: 'normal' as NodeStatus },
    ],
    connections: [
      { id: 'mc1', from: 'm1', to: 'm3', status: 'normal' as NodeStatus },
      { id: 'mc2', from: 'm2', to: 'm3', status: 'maintenance' as NodeStatus },
      { id: 'mc3', from: 'm3', to: 'm4', status: 'normal' as NodeStatus },
    ]
  },
  bcm: {
    id: 'bcm',
    name: 'Buffalo City',
    code: 'BCM',
    operator: 'Amatola Water',
    nodes: [
      { id: 'b1', type: 'source' as NodeType, name: 'Bridle Drift', level: 90, capacity: '100%', x: 40, y: 15, status: 'normal' as NodeStatus },
      { id: 'b2', type: 'source' as NodeType, name: 'Nahoon Dam', level: 85, capacity: '100%', x: 80, y: 15, status: 'normal' as NodeStatus },
      { id: 'b3', type: 'treatment' as NodeType, name: 'Umzonyana WTW', quality: '96%', x: 40, y: 50, status: 'normal' as NodeStatus },
      { id: 'b4', type: 'reservoir' as NodeType, name: 'Dawn Res', level: 60, capacity: '100 Ml', x: 40, y: 85, status: 'normal' as NodeStatus },
    ],
    connections: [
      { id: 'bc1', from: 'b1', to: 'b3', status: 'normal' as NodeStatus },
      { id: 'bc2', from: 'b3', to: 'b4', status: 'normal' as NodeStatus },
    ]
  }
};

interface SelectedElement {
  elementType: 'node' | 'connection';
  data: Node | Connection;
}

interface Notification {
  id: string;
  type: 'success' | 'warning' | 'critical';
  title: string;
  message: string;
}

// --- Helper Components ---

const StatusBadge: React.FC<{ status: NodeStatus }> = ({ status }) => {
  return (
    <span className={`status-badge status-badge-${status}`}>
      {status}
    </span>
  );
};

const NodeIcon: React.FC<{ type: NodeType }> = ({ type }) => {
  const iconClass = `node-icon-${type}`;
  switch (type) {
    case 'source': return <Waves className={iconClass} />;
    case 'treatment': return <Factory className={iconClass} />;
    case 'pump': return <Activity className={iconClass} />;
    case 'reservoir': return <Droplet className={iconClass} />;
    default: return <Droplet className={iconClass} />;
  }
};

// --- Main Component ---

interface WaterNetworkVisualizationProps {
  selectedMetroId?: string;
  onMetroChange?: (metroId: string) => void;
}

const WaterNetworkVisualization: React.FC<WaterNetworkVisualizationProps> = ({
  selectedMetroId = 'jhb',
  onMetroChange
}) => {
  const [activeRegion, setActiveRegion] = useState(selectedMetroId);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [nodes, setNodes] = useState(METRO_SYSTEMS[activeRegion as keyof typeof METRO_SYSTEMS].nodes);
  const [connections, setConnections] = useState(METRO_SYSTEMS[activeRegion as keyof typeof METRO_SYSTEMS].connections);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);

  // Sync with external metro selection
  useEffect(() => {
    if (selectedMetroId && selectedMetroId !== activeRegion) {
      setActiveRegion(selectedMetroId);
    }
  }, [selectedMetroId, activeRegion]);

  // Unified Data & Alert Loading Logic
  useEffect(() => {
    const system = METRO_SYSTEMS[activeRegion as keyof typeof METRO_SYSTEMS];
    if (system) {
        // 1. Load Data
        setNodes(system.nodes);
        setConnections(system.connections);
        setSelectedElement(null);

        // 2. Generate Alerts (Fresh List)
        const newNotifications: Notification[] = [];
        const highLevels = system.nodes.filter(n => n.type === 'source' && (n.level ?? 0) >= 100);
        const lowLevels = system.nodes.filter(n => n.type === 'source' && (n.level ?? 0) <= 20);
        const leaks = system.connections.filter(c => c.status === 'critical');

        if (highLevels.length > 0) {
            newNotifications.push({
                id: `warn-${Date.now()}-1`,
                type: 'warning',
                title: 'Overflow Risk',
                message: `${highLevels[0].name} > 100% capacity.`
            });
        }
        if (lowLevels.length > 0) {
            newNotifications.push({
                id: `crit-${Date.now()}-2`,
                type: 'critical',
                title: 'Drought Alert',
                message: `${lowLevels[0].name} critically low.`
            });
        }
        if (leaks.length > 0) {
            newNotifications.push({
                id: `leak-${Date.now()}-3`,
                type: 'critical',
                title: 'Leak Detected',
                message: `Pressure drop in bulk supply line.`
            });
        }

        // 3. Replace Notifications (Clearing previous region's alerts)
        setNotifications(newNotifications);
    }
  }, [activeRegion]);

  const addNotification = (type: 'success' | 'warning' | 'critical', title: string, message: string) => {
    setNotifications(prev => {
      if (prev.some(n => n.message === message)) return prev;
      return [{ id: Date.now().toString(), type, title, message }, ...prev];
    });
  };

  const handleDispatch = (method: string) => {
    setDispatchModalOpen(false);

    if (!selectedElement) return;

    // Update visual state locally
    if (selectedElement.elementType === 'connection') {
      setConnections(prev => prev.map(c =>
        c.id === selectedElement.data.id ? { ...c, status: 'maintenance' as NodeStatus } : c
      ));
    } else {
      setNodes(prev => prev.map(n =>
        n.id === selectedElement.data.id ? { ...n, status: 'maintenance' as NodeStatus } : n
      ));
    }

    addNotification('success', 'Team Dispatched', `Maintenance crew deployed via ${method}.`);
  };

  // --- 1px "Hairline" Rendering ---
  const renderConnection = (conn: Connection) => {
    const fromNode = nodes.find(n => n.id === conn.from);
    const toNode = nodes.find(n => n.id === conn.to);

    if (!fromNode || !toNode) return null;

    const x1 = fromNode.x;
    const y1 = fromNode.y + 7;
    const x2 = toNode.x;
    const y2 = toNode.y - 7;

    const cp1y = y1 + (y2 - y1) / 2;
    const cp2y = y2 - (y2 - y1) / 2;

    const path = `M ${x1} ${y1} C ${x1} ${cp1y}, ${x2} ${cp2y}, ${x2} ${y2}`;

    const isFlowing = conn.status !== 'maintenance';

    return (
      <g
        key={conn.id}
        onClick={() => {
            setSelectedElement({ elementType: 'connection', data: conn });
            setIsSidebarOpen(true);
        }}
        className="connection-group"
      >
        {/* Interactive Hit Area */}
        <path d={path} className="connection-hit-area" />

        {/* Physical Pipe */}
        <path
          d={path}
          className={`connection-pipe ${conn.status === 'critical' ? 'connection-pipe-critical' : ''}`}
        />

        {/* Flow Simulation */}
        {isFlowing && (
          <path
            d={path}
            className={`connection-flow connection-flow-${conn.status}`}
          />
        )}

        {/* Critical Alert Marker */}
        {conn.status === 'critical' && (
          <foreignObject x={(x1+x2)/2 - 1} y={(y1+y2)/2 - 1} width="2" height="2">
             <div className="critical-marker"></div>
          </foreignObject>
        )}
      </g>
    );
  };

  return (
    <div className="water-network-container">
      {/* Header */}
      <header className="water-network-header">
        <div className="water-network-header-title">
          <div className="water-network-icon-wrapper">
            <Waves className="water-network-icon" />
          </div>
          <div>
            <h1 className="water-network-title">Water Distribution Network</h1>
            <div className="water-network-subtitle">
              <span className="status-indicator"></span>
              Live Telemetry • {METRO_SYSTEMS[activeRegion as keyof typeof METRO_SYSTEMS]?.name || 'Loading...'}
            </div>
          </div>
        </div>

        {/* Metro Quick Switcher */}
        <div className="metro-switcher">
          {Object.values(METRO_SYSTEMS).map((metro) => (
            <button
              key={metro.id}
              onClick={() => {
                setActiveRegion(metro.id);
                if (onMetroChange) {
                  onMetroChange(metro.id);
                }
              }}
              className={`metro-switcher-btn ${activeRegion === metro.id ? 'metro-switcher-btn-active' : ''}`}
            >
              {metro.code}
            </button>
          ))}
        </div>

        <div className="water-network-header-actions">
          <button className="header-action-btn notification-btn">
            <Bell size={20} />
            {notifications.length > 0 && (
              <span className="notification-badge"></span>
            )}
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="water-network-workspace">

        {/* Canvas */}
        <main className="water-network-canvas">
          {/* Engineering Grid Background */}
          <div className="engineering-grid"></div>

          {/* SVG Layer */}
          <svg className="network-svg-layer" viewBox="0 0 100 100" preserveAspectRatio="none">
            {connections.map(renderConnection)}
          </svg>

          {/* Nodes Layer */}
          <div className="nodes-layer">
            {nodes.map(node => (
              <div
                key={node.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedElement({ elementType: 'node', data: node });
                  setIsSidebarOpen(true);
                }}
                className={`node-card ${selectedElement?.data.id === node.id ? 'node-card-selected' : ''}`}
                style={{
                  left: `${node.x}%`,
                  top: `${node.y}%`,
                }}
              >
                {/* Status Indicator Strip */}
                <div className={`node-status-strip node-status-strip-${node.status}`}></div>

                <div className="node-card-content">
                  <div className="node-card-header">
                     <div className="node-icon-wrapper">
                        <div className={`node-icon-bg node-icon-bg-${node.type}`}>
                          <NodeIcon type={node.type} />
                        </div>
                        <div className="node-info">
                          <h3 className="node-name">{node.name}</h3>
                          <p className="node-type">{node.type}</p>
                        </div>
                     </div>
                  </div>

                  {/* Metrics */}
                  <div className="node-metrics">
                    <div className="node-metrics-header">
                      <span className="node-metrics-label">
                        {node.type === 'source' ? 'Dam Level' : node.type === 'reservoir' ? 'Storage' : 'Flow Rate'}
                      </span>
                      <span className="node-metrics-value">
                        {node.type === 'source' || node.type === 'reservoir' ? `${node.level}%` : node.flow || node.quality}
                      </span>
                    </div>

                    {/* Progress Bar for Storage Nodes */}
                    {(node.type === 'source' || node.type === 'reservoir') && node.level !== undefined && (
                      <div className="node-progress-bar">
                        <div
                          className={`node-progress-fill node-progress-fill-${
                            node.level > 100 ? 'critical' :
                            node.level < 20 ? 'critical' :
                            node.level < 50 ? 'warning' : 'normal'
                          }`}
                          style={{ width: `${Math.min(node.level, 100)}%` }}
                        ></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Toggleable Legend */}
          <div className="legend-container">

            {/* Legend Panel */}
            {isLegendOpen && (
              <div className="legend-panel">
                <div className="legend-header">
                  <h4 className="legend-title">System Key</h4>
                  <button onClick={() => setIsLegendOpen(false)} className="legend-close-btn">
                    <X size={12} />
                  </button>
                </div>

                <div className="legend-items">
                  <div className="legend-item">
                    <div className="legend-line-flow"></div>
                    <span>Active Flow (1px)</span>
                  </div>
                  <div className="legend-item">
                    <div className="legend-dot-critical"></div>
                    <span>Critical Alert (2px)</span>
                  </div>
                  <div className="legend-item">
                    <div className="legend-line-maintenance"></div>
                    <span>Maintenance</span>
                  </div>
                  <div className="legend-item">
                    <div className="legend-facility-node"></div>
                    <span>Facility Node</span>
                  </div>
                </div>
              </div>
            )}

            {/* Toggle Button */}
            <button
              onClick={() => setIsLegendOpen(!isLegendOpen)}
              className="legend-toggle-btn"
            >
              <Info size={20} />
              <span>Legend</span>
            </button>
          </div>
        </main>

        {/* Collapsible Inspector Sidebar */}
        <aside className={`inspector-sidebar ${isSidebarOpen ? 'inspector-sidebar-open' : ''}`}>

          {/* Collapse Toggle Button */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="sidebar-toggle-btn"
            title={isSidebarOpen ? "Close Inspector" : "Open Inspector"}
          >
            {isSidebarOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>

          {/* Inner Content */}
          <div className={`sidebar-content ${!isSidebarOpen ? 'sidebar-content-hidden' : ''}`}>
            <div className="sidebar-header">
                <h2 className="sidebar-header-title">
                <Zap className="sidebar-header-icon" />
                Infrastructure Inspector
                </h2>
            </div>

            <div className="sidebar-body">
                {!selectedElement ? (
                <div className="sidebar-empty-state">
                    <MapIcon className="sidebar-empty-icon" />
                    <p className="sidebar-empty-text">Select a node or pipe<br/>to view telemetry.</p>
                </div>
                ) : (
                <>
                    <div className="element-details-card">
                    <div className={`element-status-bar element-status-bar-${selectedElement.data.status}`}></div>

                    <div className="element-details-content">
                        <div className="element-details-header">
                        <div>
                            <h3 className="element-name">
                            {'name' in selectedElement.data ? selectedElement.data.name : 'Pipeline Segment'}
                            </h3>
                            <div className="element-id">
                            ID: {selectedElement.data.id}
                            </div>
                        </div>
                        <StatusBadge status={selectedElement.data.status} />
                        </div>

                        {/* Dynamic Metrics Grid */}
                        <div className="element-metrics-grid">
                            <div className="element-metric-item">
                            <span className="element-metric-label">Condition</span>
                            <span className="element-metric-value">{selectedElement.data.status}</span>
                            </div>
                            {selectedElement.elementType === 'node' && 'capacity' in selectedElement.data && (
                            <div className="element-metric-item">
                                <span className="element-metric-label">
                                {selectedElement.data.capacity ? 'Current Load' : 'Throughput'}
                                </span>
                                <span className="element-metric-value">
                                {selectedElement.data.capacity ? (selectedElement.data.level ?? 0) + '%' : selectedElement.data.flow}
                                </span>
                            </div>
                            )}
                        </div>

                        {/* Action Area */}
                        {selectedElement.data.status !== 'maintenance' ? (
                        <button
                            onClick={() => setDispatchModalOpen(true)}
                            className="dispatch-btn"
                        >
                            <Wrench size={16} />
                            Dispatch Technician
                        </button>
                        ) : (
                        <div className="maintenance-status">
                            <div className="maintenance-icon-wrapper">
                            <CheckCircle size={16} />
                            </div>
                            <div>
                            <p className="maintenance-title">Maintenance In Progress</p>
                            <p className="maintenance-details">Ticket #9923 • ETA 2h 15m</p>
                            </div>
                        </div>
                        )}
                    </div>
                    </div>
                </>
                )}

                {/* Recent Alerts */}
                <div className="recent-alerts-section">
                    <div className="recent-alerts-header">
                    <h4 className="recent-alerts-title">Recent Alerts</h4>
                    {notifications.length > 0 && (
                      <button onClick={() => setNotifications([])} className="clear-alerts-btn">Clear All</button>
                    )}
                    </div>
                    {notifications.length > 0 ? (
                      notifications.map((note) => (
                        <div key={note.id} className={`alert-item alert-item-${note.type}`}>
                            <div className={`alert-icon-wrapper alert-icon-wrapper-${note.type}`}>
                            {note.type === 'critical' ? <AlertTriangle size={16} /> : <Info size={16} />}
                            </div>
                            <div className="alert-content">
                            <p className="alert-title">{note.title}</p>
                            <p className="alert-message">{note.message}</p>
                            <span className="alert-time">Just now</span>
                            </div>
                        </div>
                      ))
                    ) : (
                      <div className="alerts-empty-state">
                        <Bell className="alerts-empty-icon" />
                        <p>No recent alerts</p>
                      </div>
                    )}
                </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Dispatch Modal */}
      {dispatchModalOpen && (
        <div className="modal-overlay">
          <div className="dispatch-modal">
            <div className="dispatch-modal-header">
              <div className="dispatch-modal-icon">
                 <div className="dispatch-icon-bg">
                    <Wrench size={24} />
                 </div>
                 <button onClick={() => setDispatchModalOpen(false)} className="modal-close-btn">
                   <X size={20} />
                 </button>
              </div>
              <h3 className="dispatch-modal-title">Dispatch Maintenance</h3>
              <p className="dispatch-modal-description">
                Deploy resources to fix <span className="dispatch-asset-name">{'name' in (selectedElement?.data ?? {}) ? (selectedElement?.data as Node).name : 'this asset'}</span>.
              </p>
            </div>

            <div className="dispatch-modal-body">
              <p className="dispatch-method-label">Communication Channel</p>
              <div className="dispatch-methods">
                <button
                  onClick={() => handleDispatch('SMS')}
                  className="dispatch-method-btn"
                >
                  <MessageSquare size={24} />
                  <span>SMS Team</span>
                </button>
                <button
                  onClick={() => handleDispatch('Email')}
                  className="dispatch-method-btn"
                >
                  <Mail size={24} />
                  <span>Email Report</span>
                </button>
              </div>
              <div className="dispatch-blockchain-note">
                Action recorded on Blockchain ledger #883920
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WaterNetworkVisualization;
