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
};

export default apiService;
