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
  Maximize2,
  Minimize2,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';

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
  const colors = {
    normal: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    critical: 'bg-rose-100 text-rose-700 border-rose-200',
    maintenance: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  return (
    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${colors[status]}`}>
      {status}
    </span>
  );
};

const NodeIcon: React.FC<{ type: NodeType }> = ({ type }) => {
  switch (type) {
    case 'source': return <Waves className="w-5 h-5 text-indigo-600" />;
    case 'treatment': return <Factory className="w-5 h-5 text-cyan-600" />;
    case 'pump': return <Activity className="w-5 h-5 text-amber-600" />;
    case 'reservoir': return <Droplet className="w-5 h-5 text-blue-600" />;
    default: return <Droplet className="w-5 h-5 text-gray-600" />;
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
  const [isFullscreen, setIsFullscreen] = useState(false);
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
  }, [selectedMetroId]);

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

        // Notify parent component
        if (onMetroChange) {
          onMetroChange(activeRegion);
        }
    }
  }, [activeRegion, onMetroChange]);

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

    let coreColor = '#3b82f6'; // Blue
    let flowSpeed = '2s';

    if (conn.status === 'critical') {
      coreColor = '#ef4444'; // Red
      flowSpeed = '0.4s';
    } else if (conn.status === 'maintenance') {
      coreColor = '#f59e0b'; // Amber
      flowSpeed = '0s';
    } else if (conn.status === 'warning') {
      coreColor = '#eab308';
    }

    const isFlowing = conn.status !== 'maintenance';

    return (
      <g
        key={conn.id}
        onClick={() => {
            setSelectedElement({ elementType: 'connection', data: conn });
            setIsSidebarOpen(true);
        }}
        className="cursor-pointer group"
      >
        {/* Layer 1: Interactive Hit Area (Invisible, wide for usability) */}
        <path d={path} stroke="transparent" strokeWidth="15" fill="none" />

        {/* Layer 2: The Physical Pipe (1px) */}
        <path
          d={path}
          stroke={conn.status === 'critical' ? '#ef4444' : '#cbd5e1'}
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
          className="transition-colors group-hover:stroke-blue-400"
        />

        {/* Layer 3: The Flow Simulation (1px, dashed) */}
        {isFlowing && (
          <path
            d={path}
            stroke={coreColor}
            strokeWidth="1"
            fill="none"
            strokeLinecap="round"
            strokeDasharray="2 4"
            className="opacity-100"
            style={{
               animation: `flow ${flowSpeed} linear infinite`
            }}
          />
        )}

        {/* Critical Alert Marker (2px) */}
        {conn.status === 'critical' && (
          <foreignObject x={(x1+x2)/2 - 1} y={(y1+y2)/2 - 1} width="2" height="2">
             <div className="w-[2px] h-[2px] bg-red-600 rounded-full animate-pulse shadow-[0_0_4px_rgba(239,68,68,0.8)]"></div>
          </foreignObject>
        )}
      </g>
    );
  };

  return (
    <div className={`bg-slate-50 font-sans text-slate-900 flex flex-col transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-50 h-screen' : 'min-h-screen'}`}>
      <style>{`
        @keyframes flow {
          to { stroke-dashoffset: -6; }
        }
      `}</style>

      {/* --- Header --- */}
      <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex items-center justify-between shadow-sm z-30 shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-2.5 rounded-xl shadow-lg shadow-blue-500/20">
            <Waves className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Water Distribution Network</h1>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Telemetry • {METRO_SYSTEMS[activeRegion as keyof typeof METRO_SYSTEMS]?.name || 'Loading...'}
            </div>
          </div>
        </div>

        {/* Metro Quick Switcher (Scrollable) */}
        <div className="hidden lg:flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200 overflow-x-auto max-w-xl mx-4">
          {Object.values(METRO_SYSTEMS).map((metro) => (
            <button
              key={metro.id}
              onClick={() => setActiveRegion(metro.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                activeRegion === metro.id
                  ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/5'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              {metro.code}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          <div className="h-8 w-[1px] bg-slate-200 mx-1"></div>
          <button className="p-2 relative text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
            <Bell className="w-5 h-5" />
            {notifications.length > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-bounce"></span>
            )}
          </button>
        </div>
      </header>

      {/* --- Main Workspace --- */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Canvas */}
        <main className="flex-1 relative overflow-hidden bg-slate-50 transition-all duration-300">
          {/* Engineering Grid Background */}
          <div className="absolute inset-0 opacity-[0.05]"
               style={{
                 backgroundImage: 'linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)',
                 backgroundSize: '40px 40px'
               }}>
          </div>

          {/* SVG Layer */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
            {connections.map(renderConnection)}
          </svg>

          {/* Nodes Layer */}
          <div className="absolute inset-0 z-10 w-full h-full pointer-events-none">
            {nodes.map(node => (
              <div
                key={node.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedElement({ elementType: 'node', data: node });
                  setIsSidebarOpen(true);
                }}
                className={`absolute w-48 backdrop-blur-md bg-white/90 rounded-2xl shadow-xl border pointer-events-auto cursor-pointer transition-all duration-300 group
                  ${selectedElement?.data.id === node.id
                    ? 'border-blue-500 ring-4 ring-blue-500/10 scale-105 z-50'
                    : 'border-white/50 hover:border-blue-300 hover:scale-105 z-10'}
                `}
                style={{
                  left: `${node.x}%`,
                  top: `${node.y}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                {/* Node Status Indicator Strip */}
                <div className={`h-1 w-full rounded-t-2xl ${
                  node.status === 'normal' ? 'bg-emerald-500' :
                  node.status === 'warning' ? 'bg-amber-500' :
                  node.status === 'maintenance' ? 'bg-slate-400' : 'bg-red-500'
                }`}></div>

                <div className="p-3">
                  <div className="flex items-start justify-between mb-2">
                     <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${
                           node.type === 'source' ? 'bg-indigo-50 text-indigo-600' :
                           node.type === 'treatment' ? 'bg-cyan-50 text-cyan-600' :
                           'bg-slate-100 text-slate-600'
                        }`}>
                          <NodeIcon type={node.type} />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-slate-800 leading-tight">{node.name}</h3>
                          <p className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">{node.type}</p>
                        </div>
                     </div>
                  </div>

                  {/* Metrics */}
                  <div className="bg-slate-50/80 rounded-lg p-2 border border-slate-100/50">
                    <div className="flex items-end justify-between mb-1">
                      <span className="text-[10px] font-medium text-slate-500">
                        {node.type === 'source' ? 'Dam Level' : node.type === 'reservoir' ? 'Storage' : 'Flow Rate'}
                      </span>
                      <span className="text-sm font-bold text-slate-900 font-mono">
                        {node.type === 'source' || node.type === 'reservoir' ? `${node.level}%` : node.flow || node.quality}
                      </span>
                    </div>

                    {/* Progress Bar for Storage Nodes */}
                    {(node.type === 'source' || node.type === 'reservoir') && node.level !== undefined && (
                      <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${
                            node.level > 100 ? 'bg-rose-500' :
                            node.level < 20 ? 'bg-rose-500' :
                            node.level < 50 ? 'bg-amber-400' : 'bg-emerald-500'
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

          {/* Toggleable Legend (FAB Style) */}
          <div className="absolute bottom-6 left-6 z-20 flex flex-col items-start gap-2">

            {/* Legend Panel */}
            {isLegendOpen && (
              <div className="mb-2 bg-white/95 backdrop-blur-xl p-4 rounded-2xl shadow-2xl border border-slate-200 w-56">
                <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">System Key</h4>
                  <button onClick={() => setIsLegendOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    <div className="w-8 h-[1px] bg-blue-500 rounded-full relative overflow-hidden">
                      <div className="absolute inset-0 border-t border-b border-blue-400 border-dashed animate-pulse opacity-50"></div>
                    </div>
                    <span>Active Flow (1px)</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    <div className="w-[2px] h-[2px] bg-red-600 rounded-full"></div>
                    <span>Critical Alert (2px)</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    <div className="w-8 h-[1px] bg-slate-400 rounded-full"></div>
                    <span>Maintenance</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-600 pt-1">
                    <div className="w-3 h-3 bg-white border border-slate-200 rounded-md"></div>
                    <span>Facility Node</span>
                  </div>
                </div>
              </div>
            )}

            {/* Toggle Button */}
            <button
              onClick={() => setIsLegendOpen(!isLegendOpen)}
              className="group flex items-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-full shadow-lg hover:bg-slate-800 transition-all hover:scale-105 active:scale-95"
            >
              <Info className="w-5 h-5" />
              <span className="text-sm font-medium pr-1">Legend</span>
            </button>
          </div>
        </main>

        {/* --- Collapsible Inspector Sidebar --- */}
        <aside className={`${isSidebarOpen ? 'w-96' : 'w-0'} bg-white border-l border-slate-200 z-20 flex flex-col shadow-2xl transition-all duration-300 ease-in-out relative overflow-visible`}>

          {/* Collapse Toggle Button - Always Visible due to overflow-visible */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="absolute -left-5 top-1/2 transform -translate-y-1/2 bg-white border border-slate-200 shadow-lg rounded-full p-2 text-slate-600 hover:text-blue-600 hover:scale-110 hover:border-blue-200 transition-all z-30 flex items-center justify-center ring-2 ring-transparent focus:ring-blue-100"
            title={isSidebarOpen ? "Close Inspector" : "Open Inspector"}
          >
            {isSidebarOpen ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>

          {/* Inner Content - Wrapped to handle fade/hide gracefully */}
          <div className={`flex flex-col h-full w-96 transition-opacity duration-200 ${!isSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <div className="p-5 border-b border-slate-100 bg-slate-50/80 backdrop-blur">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                Infrastructure Inspector
                </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {!selectedElement ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <MapIcon className="w-10 h-10 mb-3 opacity-30" />
                    <p className="text-sm font-medium">Select a node or pipe<br/>to view telemetry.</p>
                </div>
                ) : (
                <>
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden group">
                    <div className={`h-2 w-full ${
                        selectedElement.data.status === 'critical' ? 'bg-red-500' :
                        selectedElement.data.status === 'warning' ? 'bg-amber-500' :
                        'bg-blue-500'
                    }`}></div>

                    <div className="p-5">
                        <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="font-bold text-xl text-slate-900 mb-1">
                            {'name' in selectedElement.data ? selectedElement.data.name : 'Pipeline Segment'}
                            </h3>
                            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono bg-slate-100 w-fit px-2 py-1 rounded">
                            ID: {selectedElement.data.id}
                            </div>
                        </div>
                        <StatusBadge status={selectedElement.data.status} />
                        </div>

                        {/* Dynamic Metrics Grid */}
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">Condition</span>
                            <span className="text-sm font-semibold text-slate-700 capitalize">{selectedElement.data.status}</span>
                            </div>
                            {selectedElement.elementType === 'node' && 'capacity' in selectedElement.data && (
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">
                                {selectedElement.data.capacity ? 'Current Load' : 'Throughput'}
                                </span>
                                <span className="text-sm font-semibold text-slate-700">
                                {selectedElement.data.capacity ? (selectedElement.data.level ?? 0) + '%' : selectedElement.data.flow}
                                </span>
                            </div>
                            )}
                        </div>

                        {/* Action Area */}
                        {selectedElement.data.status !== 'maintenance' ? (
                        <button
                            onClick={() => setDispatchModalOpen(true)}
                            className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-slate-200 active:scale-95"
                        >
                            <Wrench className="w-4 h-4" />
                            Dispatch Technician
                        </button>
                        ) : (
                        <div className="bg-amber-50 text-amber-800 p-4 rounded-xl text-sm flex gap-3 border border-amber-100">
                            <div className="bg-white p-1 rounded-full h-fit shadow-sm">
                            <CheckCircle className="w-4 h-4 text-amber-600" />
                            </div>
                            <div>
                            <p className="font-bold">Maintenance In Progress</p>
                            <p className="text-xs mt-1 opacity-80">Ticket #9923 • ETA 2h 15m</p>
                            </div>
                        </div>
                        )}
                    </div>
                    </div>
                </>
                )}

                {/* Notification List (Recent Alerts) */}
                {notifications.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recent Alerts</h4>
                    <button onClick={() => setNotifications([])} className="text-[10px] text-blue-600 hover:underline">Clear All</button>
                    </div>
                    {notifications.map((note) => (
                    <div key={note.id} className={`p-4 rounded-xl border text-xs flex gap-3 shadow-sm transition-all ${
                        note.type === 'critical' ? 'bg-red-50 border-red-100' :
                        note.type === 'warning' ? 'bg-amber-50 border-amber-100' :
                        'bg-emerald-50 border-emerald-100'
                    }`}>
                        <div className={`p-2 rounded-full h-fit shrink-0 ${
                        note.type === 'critical' ? 'bg-white text-red-500' :
                        note.type === 'warning' ? 'bg-white text-amber-500' :
                        'bg-white text-emerald-500'
                        }`}>
                        {note.type === 'critical' ? <AlertTriangle className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                        </div>
                        <div>
                        <p className="font-bold text-slate-800 text-sm mb-0.5">{note.title}</p>
                        <p className="text-slate-600 leading-relaxed">{note.message}</p>
                        <span className="text-[10px] text-slate-400 mt-2 block opacity-70">Just now</span>
                        </div>
                    </div>
                    ))}
                </div>
                )}
            </div>
          </div>
        </aside>
      </div>

      {/* --- Dispatch Modal --- */}
      {dispatchModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <div className="flex justify-between items-start mb-2">
                 <div className="bg-amber-100 p-2 rounded-lg text-amber-600">
                    <Wrench className="w-6 h-6" />
                 </div>
                 <button onClick={() => setDispatchModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                   <X className="w-5 h-5" />
                 </button>
              </div>
              <h3 className="text-xl font-bold text-slate-900">Dispatch Maintenance</h3>
              <p className="text-sm text-slate-500 mt-1">Deploy resources to fix <span className="font-bold text-slate-800">{'name' in (selectedElement?.data ?? {}) ? (selectedElement?.data as Node).name : 'this asset'}</span>.</p>
            </div>

            <div className="p-6 pt-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 mt-4">Communication Channel</p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  onClick={() => handleDispatch('SMS')}
                  className="flex flex-col items-center justify-center gap-2 p-4 border border-slate-200 rounded-xl hover:bg-blue-50 hover:border-blue-500 hover:text-blue-700 transition-all group"
                >
                  <MessageSquare className="w-6 h-6 text-slate-400 group-hover:text-blue-500" />
                  <span className="text-sm font-bold text-slate-600 group-hover:text-blue-700">SMS Team</span>
                </button>
                <button
                  onClick={() => handleDispatch('Email')}
                  className="flex flex-col items-center justify-center gap-2 p-4 border border-slate-200 rounded-xl hover:bg-blue-50 hover:border-blue-500 hover:text-blue-700 transition-all group"
                >
                  <Mail className="w-6 h-6 text-slate-400 group-hover:text-blue-500" />
                  <span className="text-sm font-bold text-slate-600 group-hover:text-blue-700">Email Report</span>
                </button>
              </div>
              <div className="text-[10px] text-center text-slate-400">
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
