# Ulwandle Tech API Documentation

## Base URL
```
http://localhost:8000
```

## Authentication
Currently no authentication required (add in production).

---

## 1. Dashboard Endpoints

### Get System Overview
```http
GET /api/v1/dashboard/overview
```

**Response:**
```json
{
  "system_status": "operational",
  "last_updated": "2024-01-01T12:00:00Z",
  "districts": {
    "total": 5,
    "green": 3,
    "yellow": 1,
    "red": 1
  },
  "alerts": {
    "total_24h": 12,
    "unresolved": 5,
    "critical": 2
  },
  "sensors": {
    "total": 20,
    "active": 18
  }
}
```

### Get Realtime Metrics
```http
GET /api/v1/dashboard/realtime-metrics
```

### Get Critical Issues
```http
GET /api/v1/dashboard/critical-issues
```

---

## 2. Districts Endpoints

### Get All Districts
```http
GET /api/v1/districts/
```

**Query Parameters:**
- `status` (optional): green, yellow, red
- `province` (optional): Filter by province
- `municipality` (optional): Filter by municipality

### Get Red-Flagged Districts
```http
GET /api/v1/districts/red-flagged/list
```

**Response:**
```json
{
  "count": 2,
  "critical_status": "RED - Undrinkable Water",
  "districts": [
    {
      "id": 1,
      "name": "Cape Town Central",
      "population": 433000,
      "status": "red"
    }
  ]
}
```

### Get District Details
```http
GET /api/v1/districts/{district_id}
```

---

## 3. Water Quality Endpoints

### Add Water Quality Reading
```http
POST /api/v1/water-quality/readings
```

**Request Body:**
```json
{
  "district_id": 1,
  "ph": 7.2,
  "tds": 850,
  "turbidity": 2.5,
  "temperature": 18.5,
  "chlorine": 1.2
}
```

**Response:**
```json
{
  "message": "Water quality reading recorded",
  "reading_id": 123,
  "meets_standards": true,
  "violations": []
}
```

### Analyze Water Quality (AI)
```http
POST /api/v1/water-quality/analyze/{district_id}?hours=24
```

**Response:**
```json
{
  "district_name": "Cape Town Central",
  "analysis": {
    "compliance_status": {
      "meets_standards": false,
      "violations": [
        {
          "parameter": "ph",
          "value": 5.2,
          "standard": 6.0,
          "severity": "high"
        }
      ]
    },
    "drinkability": "unsafe",
    "district_status": "red",
    "summary": "Water quality has deteriorated..."
  }
}
```

### Get Compliance Summary
```http
GET /api/v1/water-quality/compliance-summary
```

---

## 4. Kill Switch (Valve Control) Endpoints

### Get All Valves
```http
GET /api/v1/kill-switch/valves
```

**Query Parameters:**
- `district_id` (optional): Filter by district
- `status` (optional): open, closed, partial, fault

### Operate Valve
```http
POST /api/v1/kill-switch/valves/{valve_id}/operate
```

**Request Body:**
```json
{
  "action": "close",
  "operator_name": "John Doe",
  "reason": "Emergency maintenance required",
  "is_manual": true,
  "bypass_confirmation": false
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Valve close operation completed successfully",
  "valve_id": "VALVE-0001",
  "action": "close",
  "previous_status": "open",
  "new_status": "closed",
  "operator": "John Doe",
  "employees_notified": true
}
```

### Emergency District Shutdown
```http
POST /api/v1/kill-switch/emergency-shutdown/{district_id}
```

**Query Parameters:**
- `operator_name`: Name of operator
- `reason`: Reason for shutdown

**⚠️ WARNING: This closes ALL valves in the district!**

### Get Valve Operation History
```http
GET /api/v1/kill-switch/valves/{valve_id}/operations
```

---

## 5. AI Predictions Endpoints

### Analyze Consumption Patterns
```http
POST /api/v1/predictions/analyze
```

**Request Body:**
```json
{
  "district_id": 1,
  "prediction_type": "consumption",
  "horizon": "24h",
  "historical_hours": 168
}
```

**Response:**
```json
{
  "status": "success",
  "prediction_id": 456,
  "district_name": "Cape Town Central",
  "analysis": {
    "patterns": {
      "daily_trend": "increasing",
      "anomalies_detected": true,
      "anomaly_details": ["Unusual spike at 2AM"]
    },
    "leak_detection": {
      "potential_leaks": true,
      "confidence_score": 0.85,
      "estimated_loss_lpm": 45.2
    },
    "predictions": {
      "next_24h": 125000,
      "next_7d": 875000,
      "next_30d": 3750000
    },
    "risk_assessment": {
      "level": "medium",
      "risks": ["Potential leak detected"],
      "mitigation": ["Inspect area X immediately"]
    }
  }
}
```

### Forecast Consumption
```http
POST /api/v1/predictions/forecast/{district_id}?horizon=24h
```

**Horizon Options:**
- `1h`: 1 hour
- `24h`: 24 hours
- `7d`: 7 days
- `30d`: 30 days

### Get Predictions History
```http
GET /api/v1/predictions/predictions?district_id=1&hours=24
```

### Get Consumption Patterns
```http
GET /api/v1/predictions/patterns/{district_id}?days=7
```

---

## 6. Monitoring Endpoints

### Get Sensors
```http
GET /api/v1/monitoring/sensors
```

**Query Parameters:**
- `district_id` (optional)
- `sensor_type` (optional): flow, pressure, ph, tds
- `is_active` (optional): true/false

### Add Flow Reading
```http
POST /api/v1/monitoring/flow-readings
```

**Request Body:**
```json
{
  "sensor_id": 1,
  "flow_rate": 125.5,
  "total_volume": 5000
}
```

### Get Flow Readings
```http
GET /api/v1/monitoring/flow-readings?district_id=1&hours=24
```

### Get Leak Detections
```http
GET /api/v1/monitoring/leaks?district_id=1
```

**Query Parameters:**
- `district_id` (optional)
- `is_confirmed` (optional): true/false
- `is_repaired` (optional): true/false

### Get Monitoring Statistics
```http
GET /api/v1/monitoring/statistics?district_id=1&hours=24
```

---

## 7. Alerts Endpoints

### Get Alerts
```http
GET /api/v1/alerts/
```

**Query Parameters:**
- `district_id` (optional)
- `alert_type` (optional): leak, quality, valve, prediction, emergency
- `level` (optional): info, warning, critical, emergency
- `is_resolved` (optional): true/false
- `hours` (optional): Number of hours to retrieve (default: 24)

### Get Alert Details
```http
GET /api/v1/alerts/{alert_id}
```

### Resolve Alert
```http
PUT /api/v1/alerts/{alert_id}/resolve?resolved_by=John Doe
```

### Get Alert Statistics
```http
GET /api/v1/alerts/statistics/summary?hours=24
```

---

## 8. WebSocket (Real-time Updates)

### Connect to WebSocket
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/client_123');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

**Message Types:**
- `alert`: System alert
- `valve_operation`: Valve control notification
- `water_quality`: Water quality alert
- `leak_detected`: Leak detection notification
- `prediction`: AI prediction update

---

## Status Codes

- `200 OK`: Successful request
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request data
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

---

## Claude AI Integration

The following endpoints use Claude AI for intelligent analysis:

1. **Water Quality Analysis** (`POST /api/v1/water-quality/analyze/{district_id}`)
   - Analyzes compliance with SANS 241
   - Determines drinkability
   - Provides health risk assessment

2. **Consumption Pattern Analysis** (`POST /api/v1/predictions/analyze`)
   - Detects anomalies and leaks
   - Predicts future consumption
   - Provides risk assessment

3. **Valve Operation Decision** (Internal - called during valve operations)
   - Analyzes safety of valve closure
   - Assesses population impact
   - Provides recommendations

---

## Rate Limiting

No rate limiting currently implemented. Add in production.

---

## Examples

### Complete Workflow: Add Sensor Data and Get AI Analysis

```bash
# 1. Add water quality reading
curl -X POST http://localhost:8000/api/v1/water-quality/readings \
  -H "Content-Type: application/json" \
  -d '{
    "district_id": 1,
    "ph": 5.8,
    "tds": 1350,
    "turbidity": 6.2
  }'

# 2. Analyze with AI
curl -X POST http://localhost:8000/api/v1/water-quality/analyze/1?hours=24

# 3. Check alerts
curl http://localhost:8000/api/v1/alerts/?district_id=1&is_resolved=false
```

---

## Error Responses

```json
{
  "detail": "Error message here"
}
```

---

For interactive API documentation, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
