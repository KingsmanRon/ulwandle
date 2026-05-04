import axios, { AxiosInstance } from "axios";

const API_BASE_URL = process.env.REACT_APP_API_URL || "";

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: false,
  timeout: 30_000,
});

let _accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  _accessToken = token;
  if (token) {
    apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common["Authorization"];
  }
}

export function getAccessToken(): string | null {
  return _accessToken;
}

export function clearTokens(): void {
  setAccessToken(null);
}

// ---------- Domain ----------

export const apiService = {
  getDashboardOverview: async () => (await apiClient.get("/api/v1/dashboard/overview")).data,
  getRealtimeMetrics:   async () => (await apiClient.get("/api/v1/dashboard/realtime-metrics")).data,
  getCriticalIssues:    async () => (await apiClient.get("/api/v1/dashboard/critical-issues")).data,

  getDistricts:         async () => (await apiClient.get("/api/v1/districts/")).data,
  getDistrict:          async (id: number) => (await apiClient.get(`/api/v1/districts/${id}`)).data,
  getRedFlagged:        async () => (await apiClient.get("/api/v1/districts/red-flagged/list")).data,

  getWaterQuality:      async (districtId?: number, hours = 24) =>
    (await apiClient.get("/api/v1/water-quality/readings", { params: { district_id: districtId, hours } })).data,
  analyzeQuality:       async (districtId: number, hours = 24) =>
    (await apiClient.post(`/api/v1/water-quality/analyze/${districtId}`, null, { params: { hours } })).data,

  getValves:            async (districtId?: number) =>
    (await apiClient.get("/api/v1/kill-switch/valves", { params: { district_id: districtId } })).data,
  proposeValveOp:       async (body: object) =>
    (await apiClient.post("/api/v1/kill-switch/proposals", body)).data,
  approveProposal:      async (id: number, signature: string) =>
    (await apiClient.post(`/api/v1/kill-switch/proposals/${id}/approve`, { signature })).data,
  listProposals:        async (status?: string) =>
    (await apiClient.get("/api/v1/kill-switch/proposals", { params: { status_filter: status } })).data,

  getAlerts:            async (filters?: object) =>
    (await apiClient.get("/api/v1/alerts/", { params: filters })).data,
  resolveAlert:         async (id: number, note?: string) =>
    (await apiClient.put(`/api/v1/alerts/${id}/resolve`, { note })).data,

  registerSigningKey:   async (publicKey: string) =>
    (await apiClient.put("/api/v1/auth/me/signing-key",
      { ed25519_public_key: publicKey })).data,

  getPredictions:       async (districtId?: number, hours = 24) =>
    (await apiClient.get("/api/v1/predictions/predictions",
      { params: { district_id: districtId, hours } })).data,

  getComplianceSummary: async () =>
    (await apiClient.get("/api/v1/water-quality/standards")).data,

  // Metros — mix of real (population, NRW, dam levels) + synthetic
  // (topology, zones, leak detections). Real-data endpoints carry full
  // SourceRef attribution; synthetic ones do not.
  getMetros:            async () =>
    (await apiClient.get("/api/v1/metros/")).data,
  getMetro:             async (metroId: string) =>
    (await apiClient.get(`/api/v1/metros/${encodeURIComponent(metroId)}`)).data,
  getMetroBaselines:    async () =>
    (await apiClient.get("/api/v1/metros/baseline")).data as MetroBaseline[],
  getMetroBaseline:     async (metroId: string) =>
    (await apiClient.get(`/api/v1/metros/baseline/${encodeURIComponent(metroId)}`)).data as MetroBaseline,
  getMetroDamLevels:    async (metroId: string) =>
    (await apiClient.get(`/api/v1/metros/${encodeURIComponent(metroId)}/dams`)).data as MetroDamsResponse,
  getMetroNetwork:      async (metroId: string) =>
    (await apiClient.get(`/api/v1/metros/${encodeURIComponent(metroId)}/network`)).data,
  getMetroZones:        async (metroId: string) =>
    (await apiClient.get(`/api/v1/metros/${encodeURIComponent(metroId)}/zones`)).data,
  getMetroProblemZones: async (metroId: string) =>
    (await apiClient.get(`/api/v1/metros/${encodeURIComponent(metroId)}/zones/problem-areas`)).data,
  getMetroLeaks:        async (metroId: string, status?: string) =>
    (await apiClient.get(`/api/v1/metros/${encodeURIComponent(metroId)}/leaks`,
      { params: { status } })).data,
  getMetroCriticalLeaks: async (metroId: string) =>
    (await apiClient.get(`/api/v1/metros/${encodeURIComponent(metroId)}/leaks/critical`)).data,
  getNetworkStats:      async () =>
    (await apiClient.get("/api/v1/metros/stats/overview")).data,
  updateLeakStatus:     async (leakId: string, body: { new_status: string; notes?: string }) =>
    (await apiClient.post(`/api/v1/metros/leaks/${encodeURIComponent(leakId)}/update-status`, body)).data,
};

// ---------- Real-data response types ----------

export interface SourceRef {
  name: string;
  as_of: string;
  url?: string | null;
  caveat?: string | null;
}

export interface MetroBaseline {
  metro_id: string;
  code: string;
  name: string;
  province: string;
  lat?: number | null;
  lng?: number | null;
  population: number;
  population_source: SourceRef;
  nrw_pct: number;
  nrw_source: SourceRef;
  per_capita_lpcd?: number | null;
  per_capita_source?: SourceRef | null;
}

export interface DamLevel {
  dam_id: string;
  name: string;
  storage_pct: number;
  storage_ml?: number | null;
  full_capacity_ml?: number | null;
  as_of: string;
  source: SourceRef;
  is_primary: boolean;
}

export interface MetroDamsResponse {
  metro_id: string;
  dams: DamLevel[];
  weighted_storage_pct?: number | null;
  has_data: boolean;
}

export default apiService;
