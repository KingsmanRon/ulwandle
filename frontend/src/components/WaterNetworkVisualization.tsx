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

// --- Configuration: water distribution topology per metro ----------
//
// Sources (verified May 2026):
// - Rand Water: 2 purification plants (Vereeniging, Zuikerbosch) +
//   4 booster stations (Zwartkopjes, Palmiet, Mapleton, Eikenhof);
//   3500 km regional pipeline; 60 service reservoirs.
// - City of Cape Town WTWs: Faure 500 Mℓ/d, Voëlvlei 273 Mℓ/d,
//   Wemmershoek 250 Mℓ/d, Blackheath 430 Mℓ/d.
// - uMngeni-uThukela Water: Durban Heights (340 Mℓ, largest in
//   eThekwini), Wiggins (gravity), Hazelmere (75 Mℓ/d post-upgrade).
// - Tshwane: ~85% Rand Water bulk; own Rietvlei WTW (20 Mℓ/d, ~15%),
//   Roodeplaat WTW (60 Mℓ/d, ozonation+GAC), Temba WTW (Hammanskraal).
// - NMBM: Nooitgedacht WTW (200 Mℓ/d, sourced from Gariep Dam via
//   Orange-Fish-Sundays transfer), Loerie WTW boost; Churchill kept
//   as emergency reserve since 2024.
// - Bloem Water: Welbedacht WTW 145 Mℓ/d to Bloemfontein (66% of
//   metro supply), Rustfontein WTW to Botshabelo/Thaba Nchu;
//   Mangaung's own Maselspoort WTP for the rest.
// - Buffalo City: Umzonyana WTW (~100 Mℓ/d effective, 80% of supply,
//   from Bridle Drift Dam); Nahoon Dam WTW supplies coastal areas.
//
// Topology shown is illustrative — node placement is not
// geographic. Status fields default to 'normal'; per-dam storage is
// served live via /api/v1/metros/{id}/dams in the Sources tab.

const METRO_SYSTEMS: Record<string, MetroSystem> = {
  johannesburg: {
    id: 'johannesburg',
    name: 'City of Johannesburg',
    code: 'JHB',
    operator: 'Rand Water (bulk) → Joburg Water (distribution)',
    nodes: [
      { id: 'j1', type: 'source', name: 'Vaal Dam', capacity: '2,536 Mℓ FSC', x: 50, y: 8, status: 'normal' },
      { id: 'j2', type: 'treatment', name: 'Zuikerbosch Purif.', quality: '3,800 Mℓ/d', x: 30, y: 28, status: 'normal' },
      { id: 'j3', type: 'treatment', name: 'Vereeniging Purif.', quality: '900 Mℓ/d', x: 70, y: 28, status: 'normal' },
      { id: 'j4', type: 'pump', name: 'Mapleton Booster', flow: 'to JHB N+E', x: 25, y: 50, status: 'normal' },
      { id: 'j5', type: 'pump', name: 'Eikenhof Booster', flow: 'to JHB S+W', x: 50, y: 50, status: 'normal' },
      { id: 'j6', type: 'pump', name: 'Palmiet Booster', flow: 'to Soweto', x: 75, y: 50, status: 'normal' },
      { id: 'j7', type: 'reservoir', name: 'Sandton / North', capacity: 'service tier', x: 25, y: 80, status: 'normal' },
      { id: 'j8', type: 'reservoir', name: 'Meredale / South', capacity: 'service tier', x: 50, y: 80, status: 'normal' },
      { id: 'j9', type: 'reservoir', name: 'Soweto / SW', capacity: 'service tier', x: 75, y: 80, status: 'normal' },
    ],
    connections: [
      { id: 'jc1', from: 'j1', to: 'j2', status: 'normal' },
      { id: 'jc2', from: 'j1', to: 'j3', status: 'normal' },
      { id: 'jc3', from: 'j2', to: 'j4', status: 'normal' },
      { id: 'jc4', from: 'j2', to: 'j5', status: 'normal' },
      { id: 'jc5', from: 'j3', to: 'j6', status: 'normal' },
      { id: 'jc6', from: 'j4', to: 'j7', status: 'normal' },
      { id: 'jc7', from: 'j5', to: 'j8', status: 'normal' },
      { id: 'jc8', from: 'j6', to: 'j9', status: 'normal' },
    ],
  },
  cape_town: {
    id: 'cape_town',
    name: 'City of Cape Town',
    code: 'CPT',
    operator: 'City of Cape Town Water & Sanitation',
    nodes: [
      { id: 'c1', type: 'source', name: 'Theewaterskloof', capacity: '480,188 Mℓ', x: 20, y: 8, status: 'normal' },
      { id: 'c2', type: 'source', name: 'Voëlvlei', capacity: '164,095 Mℓ', x: 50, y: 8, status: 'normal' },
      { id: 'c3', type: 'source', name: 'Berg River + Wemmershoek', capacity: '188,654 Mℓ', x: 80, y: 8, status: 'normal' },
      { id: 'c4', type: 'treatment', name: 'Faure WTW', quality: '500 Mℓ/d', x: 20, y: 45, status: 'normal' },
      { id: 'c5', type: 'treatment', name: 'Voëlvlei WTW', quality: '273 Mℓ/d', x: 45, y: 45, status: 'normal' },
      { id: 'c6', type: 'treatment', name: 'Blackheath WTW', quality: '430 Mℓ/d', x: 65, y: 45, status: 'normal' },
      { id: 'c7', type: 'treatment', name: 'Wemmershoek WTW', quality: '250 Mℓ/d', x: 88, y: 45, status: 'normal' },
      { id: 'c8', type: 'reservoir', name: 'Cape Flats / Mitchells Plain', capacity: 'Faure supply', x: 20, y: 82, status: 'normal' },
      { id: 'c9', type: 'reservoir', name: 'Northern Suburbs / CBD', capacity: 'Voëlvlei + Blackheath', x: 55, y: 82, status: 'normal' },
      { id: 'c10', type: 'reservoir', name: 'Tygerberg / Bellville', capacity: 'Wemmershoek supply', x: 88, y: 82, status: 'normal' },
    ],
    connections: [
      { id: 'cc1', from: 'c1', to: 'c4', status: 'normal' },
      { id: 'cc2', from: 'c2', to: 'c5', status: 'normal' },
      { id: 'cc3', from: 'c1', to: 'c6', status: 'normal' },
      { id: 'cc4', from: 'c3', to: 'c7', status: 'normal' },
      { id: 'cc5', from: 'c4', to: 'c8', status: 'normal' },
      { id: 'cc6', from: 'c5', to: 'c9', status: 'normal' },
      { id: 'cc7', from: 'c6', to: 'c9', status: 'normal' },
      { id: 'cc8', from: 'c7', to: 'c10', status: 'normal' },
    ],
  },
  ethekwini: {
    id: 'ethekwini',
    name: 'eThekwini (Durban)',
    code: 'ETH',
    operator: 'uMngeni-uThukela Water (bulk) → eThekwini Water',
    nodes: [
      { id: 'e1', type: 'source', name: 'Midmar Dam', capacity: '235,400 Mℓ', x: 18, y: 8, status: 'normal' },
      { id: 'e2', type: 'source', name: 'Albert Falls + Nagle', capacity: '310,600 Mℓ', x: 45, y: 8, status: 'normal' },
      { id: 'e3', type: 'source', name: 'Inanda Dam', capacity: '241,700 Mℓ', x: 70, y: 8, status: 'normal' },
      { id: 'e4', type: 'source', name: 'Hazelmere Dam', capacity: '23,600 Mℓ', x: 90, y: 8, status: 'normal' },
      { id: 'e5', type: 'treatment', name: 'Durban Heights WTW', quality: 'largest, 340 Mℓ res', x: 30, y: 50, status: 'normal' },
      { id: 'e6', type: 'treatment', name: 'Wiggins WTW (gravity)', quality: 'south DBN', x: 60, y: 50, status: 'normal' },
      { id: 'e7', type: 'treatment', name: 'Hazelmere WTW', quality: '75 Mℓ/d', x: 90, y: 50, status: 'normal' },
      { id: 'e8', type: 'reservoir', name: 'Inanda / Phoenix / KwaMashu', capacity: 'Durban Heights', x: 25, y: 85, status: 'normal' },
      { id: 'e9', type: 'reservoir', name: 'Umlazi / Folweni', capacity: 'Wiggins gravity', x: 60, y: 85, status: 'normal' },
      { id: 'e10', type: 'reservoir', name: 'iLembe / North Coast', capacity: 'Hazelmere supply', x: 90, y: 85, status: 'normal' },
    ],
    connections: [
      { id: 'ec1', from: 'e1', to: 'e5', status: 'normal' },
      { id: 'ec2', from: 'e2', to: 'e5', status: 'normal' },
      { id: 'ec3', from: 'e2', to: 'e6', status: 'normal' },
      { id: 'ec4', from: 'e3', to: 'e6', status: 'normal' },
      { id: 'ec5', from: 'e4', to: 'e7', status: 'normal' },
      { id: 'ec6', from: 'e5', to: 'e8', status: 'normal' },
      { id: 'ec7', from: 'e6', to: 'e9', status: 'normal' },
      { id: 'ec8', from: 'e7', to: 'e10', status: 'normal' },
    ],
  },
  tshwane: {
    id: 'tshwane',
    name: 'City of Tshwane',
    code: 'TSH',
    operator: 'Rand Water (~85%) + Magalies + own (Rietvlei/Roodeplaat/Temba)',
    nodes: [
      { id: 't1', type: 'source', name: 'Vaal (via Rand Water)', capacity: 'bulk import', x: 20, y: 8, status: 'normal' },
      { id: 't2', type: 'source', name: 'Rietvlei Dam', capacity: 'metro own', x: 45, y: 8, status: 'normal' },
      { id: 't3', type: 'source', name: 'Roodeplaat Dam', capacity: 'metro own', x: 70, y: 8, status: 'normal' },
      { id: 't4', type: 'source', name: 'Apies → Temba', capacity: 'Hammanskraal feed', x: 90, y: 8, status: 'normal' },
      { id: 't5', type: 'pump', name: 'Rand Water Tshwane Inlet', flow: 'bulk supply', x: 20, y: 45, status: 'normal' },
      { id: 't6', type: 'treatment', name: 'Rietvlei WTW', quality: '20 Mℓ/d', x: 45, y: 45, status: 'normal' },
      { id: 't7', type: 'treatment', name: 'Roodeplaat WTW', quality: '60 Mℓ/d', x: 70, y: 45, status: 'normal' },
      { id: 't8', type: 'treatment', name: 'Temba WTW', quality: 'Hammanskraal', x: 90, y: 45, status: 'warning' },
      { id: 't9', type: 'reservoir', name: 'Pretoria CBD / South', capacity: '160 reservoirs total', x: 35, y: 82, status: 'normal' },
      { id: 't10', type: 'reservoir', name: 'East / Garsfontein', capacity: '42 water towers', x: 65, y: 82, status: 'normal' },
      { id: 't11', type: 'reservoir', name: 'North / Hammanskraal', capacity: 'Rooiwal/Temba', x: 90, y: 82, status: 'warning' },
    ],
    connections: [
      { id: 'tc1', from: 't1', to: 't5', status: 'normal' },
      { id: 'tc2', from: 't2', to: 't6', status: 'normal' },
      { id: 'tc3', from: 't3', to: 't7', status: 'normal' },
      { id: 'tc4', from: 't4', to: 't8', status: 'normal' },
      { id: 'tc5', from: 't5', to: 't9', status: 'normal' },
      { id: 'tc6', from: 't5', to: 't10', status: 'normal' },
      { id: 'tc7', from: 't6', to: 't9', status: 'normal' },
      { id: 'tc8', from: 't7', to: 't10', status: 'normal' },
      { id: 'tc9', from: 't8', to: 't11', status: 'warning' },
    ],
  },
  nelson_mandela_bay: {
    id: 'nelson_mandela_bay',
    name: 'Nelson Mandela Bay',
    code: 'NMB',
    operator: 'NMBM Water Services',
    nodes: [
      { id: 'n1', type: 'source', name: 'Gariep Dam (via O-F-S transfer)', capacity: 'primary since 2022', x: 20, y: 8, status: 'normal' },
      { id: 'n2', type: 'source', name: 'Kouga + Loerie', capacity: '128,900 + 11,000 Mℓ', x: 50, y: 8, status: 'normal' },
      { id: 'n3', type: 'source', name: 'Impofu', capacity: '105,800 Mℓ', x: 75, y: 8, status: 'normal' },
      { id: 'n4', type: 'source', name: 'Churchill (reserve)', capacity: 'emergency only', x: 92, y: 8, status: 'maintenance' },
      { id: 'n5', type: 'treatment', name: 'Nooitgedacht WTW', quality: '200 Mℓ/d (largest)', x: 25, y: 50, status: 'normal' },
      { id: 'n6', type: 'treatment', name: 'Loerie WTW', quality: 'boost capacity', x: 60, y: 50, status: 'normal' },
      { id: 'n7', type: 'treatment', name: 'Churchill WTW', quality: 'standby', x: 92, y: 50, status: 'maintenance' },
      { id: 'n8', type: 'reservoir', name: 'PE West / Coega', capacity: 'Nooitgedacht', x: 25, y: 82, status: 'normal' },
      { id: 'n9', type: 'reservoir', name: 'PE Central / South', capacity: 'Loerie / Kouga blend', x: 60, y: 82, status: 'normal' },
    ],
    connections: [
      { id: 'nc1', from: 'n1', to: 'n5', status: 'normal' },
      { id: 'nc2', from: 'n2', to: 'n6', status: 'normal' },
      { id: 'nc3', from: 'n3', to: 'n6', status: 'normal' },
      { id: 'nc4', from: 'n4', to: 'n7', status: 'maintenance' },
      { id: 'nc5', from: 'n5', to: 'n8', status: 'normal' },
      { id: 'nc6', from: 'n6', to: 'n9', status: 'normal' },
    ],
  },
  ekurhuleni: {
    id: 'ekurhuleni',
    name: 'City of Ekurhuleni',
    code: 'EKU',
    operator: 'Rand Water (bulk, 813 Mℓ/d) → Ekurhuleni Water',
    nodes: [
      { id: 'ek1', type: 'source', name: 'Vaal (via Rand Water)', capacity: '813 Mℓ/d agreement', x: 50, y: 8, status: 'normal' },
      { id: 'ek2', type: 'treatment', name: 'Zuikerbosch (RW)', quality: '3,800 Mℓ/d shared', x: 50, y: 28, status: 'normal' },
      { id: 'ek3', type: 'pump', name: 'Mapleton Booster', flow: 'EKU primary', x: 50, y: 50, status: 'normal' },
      { id: 'ek4', type: 'reservoir', name: 'Vlakfontein Reservoir', capacity: '210 Mℓ', x: 30, y: 78, status: 'normal' },
      { id: 'ek5', type: 'reservoir', name: 'Etwatwa / North', capacity: 'service tier', x: 55, y: 78, status: 'normal' },
      { id: 'ek6', type: 'reservoir', name: 'Brakpan / South', capacity: 'service tier', x: 80, y: 78, status: 'normal' },
    ],
    connections: [
      { id: 'ekc1', from: 'ek1', to: 'ek2', status: 'normal' },
      { id: 'ekc2', from: 'ek2', to: 'ek3', status: 'normal' },
      { id: 'ekc3', from: 'ek3', to: 'ek4', status: 'normal' },
      { id: 'ekc4', from: 'ek3', to: 'ek5', status: 'normal' },
      { id: 'ekc5', from: 'ek3', to: 'ek6', status: 'normal' },
    ],
  },
  mangaung: {
    id: 'mangaung',
    name: 'Mangaung',
    code: 'MAN',
    operator: 'Bloem Water (66%) + Mangaung (Maselspoort, 34%)',
    nodes: [
      { id: 'm1', type: 'source', name: 'Welbedacht Dam', capacity: 'Caledon River', x: 20, y: 8, status: 'normal' },
      { id: 'm2', type: 'source', name: 'Rustfontein Dam', capacity: 'Modder catchment', x: 50, y: 8, status: 'normal' },
      { id: 'm3', type: 'source', name: 'Modder River (Mockes)', capacity: 'Maselspoort feed', x: 80, y: 8, status: 'normal' },
      { id: 'm4', type: 'treatment', name: 'Welbedacht WTW (BW)', quality: '145 Mℓ/d', x: 20, y: 45, status: 'normal' },
      { id: 'm5', type: 'treatment', name: 'Rustfontein WTW (BW)', quality: 'Botshabelo + ThabaNchu', x: 50, y: 45, status: 'normal' },
      { id: 'm6', type: 'treatment', name: 'Maselspoort WTP', quality: 'Mangaung own', x: 80, y: 45, status: 'normal' },
      { id: 'm7', type: 'reservoir', name: 'Bloemfontein / Brandkop', capacity: 'Welbedacht supply', x: 20, y: 82, status: 'normal' },
      { id: 'm8', type: 'reservoir', name: 'Botshabelo / Thaba Nchu', capacity: 'Rustfontein supply', x: 50, y: 82, status: 'normal' },
      { id: 'm9', type: 'reservoir', name: 'Bloem East', capacity: 'Maselspoort supply', x: 80, y: 82, status: 'normal' },
    ],
    connections: [
      { id: 'mc1', from: 'm1', to: 'm4', status: 'normal' },
      { id: 'mc2', from: 'm2', to: 'm5', status: 'normal' },
      { id: 'mc3', from: 'm3', to: 'm6', status: 'normal' },
      { id: 'mc4', from: 'm4', to: 'm7', status: 'normal' },
      { id: 'mc5', from: 'm5', to: 'm8', status: 'normal' },
      { id: 'mc6', from: 'm6', to: 'm9', status: 'normal' },
    ],
  },
  buffalo_city: {
    id: 'buffalo_city',
    name: 'Buffalo City',
    code: 'BCM',
    operator: 'Amatola Water (bulk) + Buffalo City (Umzonyana)',
    nodes: [
      { id: 'b1', type: 'source', name: 'Bridle Drift Dam', capacity: '67,300 Mℓ FSC', x: 25, y: 8, status: 'normal' },
      { id: 'b2', type: 'source', name: 'Wriggleswade + Laing', capacity: '113,200 Mℓ', x: 60, y: 8, status: 'normal' },
      { id: 'b3', type: 'source', name: 'Nahoon Dam', capacity: 'coastal feed', x: 88, y: 8, status: 'normal' },
      { id: 'b4', type: 'treatment', name: 'Umzonyana WTW', quality: '~100 Mℓ/d (80% supply)', x: 25, y: 50, status: 'warning' },
      { id: 'b5', type: 'treatment', name: 'Amatola Water bulk', quality: 'inter-basin transfer', x: 60, y: 50, status: 'normal' },
      { id: 'b6', type: 'treatment', name: 'Nahoon WTW', quality: 'coastal supply', x: 88, y: 50, status: 'normal' },
      { id: 'b7', type: 'reservoir', name: 'East London urban', capacity: 'Umzonyana primary', x: 25, y: 82, status: 'normal' },
      { id: 'b8', type: 'reservoir', name: 'Qonce (King William\'s Town)', capacity: 'Amatola supply', x: 60, y: 82, status: 'normal' },
      { id: 'b9', type: 'reservoir', name: 'Beacon Bay / Gonubie', capacity: 'Nahoon supply', x: 88, y: 82, status: 'normal' },
    ],
    connections: [
      { id: 'bc1', from: 'b1', to: 'b4', status: 'normal' },
      { id: 'bc2', from: 'b2', to: 'b5', status: 'normal' },
      { id: 'bc3', from: 'b3', to: 'b6', status: 'normal' },
      { id: 'bc4', from: 'b4', to: 'b7', status: 'normal' },
      { id: 'bc5', from: 'b5', to: 'b8', status: 'normal' },
      { id: 'bc6', from: 'b6', to: 'b9', status: 'normal' },
    ],
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
  selectedMetroId = 'johannesburg',
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
              {METRO_SYSTEMS[activeRegion as keyof typeof METRO_SYSTEMS]?.name || 'Loading...'}
              {METRO_SYSTEMS[activeRegion as keyof typeof METRO_SYSTEMS]?.operator && (
                <> · <em>{METRO_SYSTEMS[activeRegion as keyof typeof METRO_SYSTEMS].operator}</em></>
              )}
            </div>
            <div className="water-network-caveat">
              Topology illustrative · node placement is not geographic ·
              dam levels are live in the Sources tab
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
              <div className="dispatch-audit-note">
                Action will be recorded in the audit log when wired to the
                backend. This panel currently dispatches no real action.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WaterNetworkVisualization;
