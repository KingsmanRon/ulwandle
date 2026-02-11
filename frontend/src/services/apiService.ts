import axios from 'axios';

export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiService = {
  // System Status
  getSystemStatus: async () => {
    const response = await api.get('/api/v1/dashboard/overview');
    return response.data;
  },

  // Dashboard
  getDashboardOverview: async () => {
    const response = await api.get('/api/v1/dashboard/overview');
    return response.data;
  },

  getRealtimeMetrics: async () => {
    const response = await api.get('/api/v1/dashboard/realtime-metrics');
    return response.data;
  },

  getCriticalIssues: async () => {
    const response = await api.get('/api/v1/dashboard/critical-issues');
    return response.data;
  },

  // Districts
  getDistricts: async (filters?: any) => {
    const response = await api.get('/api/v1/districts/', { params: filters });
    return response.data;
  },

  getDistrictDetails: async (districtId: number) => {
    const response = await api.get(`/api/v1/districts/${districtId}`);
    return response.data;
  },

  getRedFlaggedDistricts: async () => {
    const response = await api.get('/api/v1/districts/red-flagged/list');
    return response.data;
  },

  // Water Quality
  getWaterQualityReadings: async (districtId?: number, hours: number = 24) => {
    const response = await api.get('/api/v1/water-quality/readings', {
      params: { district_id: districtId, hours }
    });
    return response.data;
  },

  analyzeWaterQuality: async (districtId: number, hours: number = 24) => {
    const response = await api.post(`/api/v1/water-quality/analyze/${districtId}`, null, {
      params: { hours }
    });
    return response.data;
  },

  getComplianceSummary: async () => {
    const response = await api.get('/api/v1/water-quality/compliance-summary');
    return response.data;
  },

  // Kill Switch (Valves)
  getValves: async (districtId?: number) => {
    const response = await api.get('/api/v1/kill-switch/valves', {
      params: { district_id: districtId }
    });
    return response.data;
  },

  operateValve: async (valveId: string, data: any) => {
    const response = await api.post(`/api/v1/kill-switch/valves/${valveId}/operate`, data);
    return response.data;
  },

  emergencyShutdown: async (districtId: number, operatorName: string, reason: string) => {
    const response = await api.post(`/api/v1/kill-switch/emergency-shutdown/${districtId}`, null, {
      params: { operator_name: operatorName, reason }
    });
    return response.data;
  },

  // Predictions
  analyzePredictions: async (data: any) => {
    const response = await api.post('/api/v1/predictions/analyze', data);
    return response.data;
  },

  getPredictions: async (districtId?: number, hours: number = 24) => {
    const response = await api.get('/api/v1/predictions/predictions', {
      params: { district_id: districtId, hours }
    });
    return response.data;
  },

  forecastConsumption: async (districtId: number, horizon: string = '24h') => {
    const response = await api.post(`/api/v1/predictions/forecast/${districtId}`, null, {
      params: { horizon }
    });
    return response.data;
  },

  // Alerts
  getAlerts: async (filters?: any) => {
    const response = await api.get('/api/v1/alerts/', { params: filters });
    return response.data;
  },

  resolveAlert: async (alertId: number, resolvedBy: string) => {
    const response = await api.put(`/api/v1/alerts/${alertId}/resolve`, null, {
      params: { resolved_by: resolvedBy }
    });
    return response.data;
  },

  // Monitoring
  getSensors: async (districtId?: number) => {
    const response = await api.get('/api/v1/monitoring/sensors', {
      params: { district_id: districtId }
    });
    return response.data;
  },

  getFlowReadings: async (districtId?: number, hours: number = 24) => {
    const response = await api.get('/api/v1/monitoring/flow-readings', {
      params: { district_id: districtId, hours }
    });
    return response.data;
  },

  getLeakDetections: async (districtId?: number) => {
    const response = await api.get('/api/v1/monitoring/leaks', {
      params: { district_id: districtId }
    });
    return response.data;
  },
};

export default apiService;
