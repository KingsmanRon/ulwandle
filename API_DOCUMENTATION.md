# Ulwandle Tech API Documentation

**Version:** 1.0.0
**Base URL:** `http://localhost:8000`

---

## Table of Contents

- [Authentication](#authentication)
- [Dashboard Endpoints](#dashboard-endpoints)
- [Metro Endpoints](#metro-endpoints)
- [Claude AI Endpoints](#claude-ai-endpoints)
- [Notification Endpoints](#notification-endpoints)
- [Status Codes](#status-codes)
- [Examples](#examples)

---

## Authentication

Currently, no authentication is required (development mode). Authentication will be added in production using JWT tokens.

---

## Dashboard Endpoints

### Get System Overview

Get overall system status and metrics.

```http
GET /api/v1/dashboard/overview
```

**Response:**
```json
{
  "system_status": "operational",
  "last_updated": "2025-12-05T12:00:00Z",
  "total_metros": 8,
  "active_metros": 8,
  "total_population": 23238127,
  "application_version": "1.0.0"
}
```

---

## Metro Endpoints

### Get All Metros

Retrieve information about all 8 South African metropolitan municipalities.

```http
GET /api/v1/metros/
```

**Response:**
```json
{
  "count": 8,
  "metros": [
    {
      "id": "jhb",
      "name": "City of Johannesburg",
      "province": "Gauteng",
      "population": 5635127,
      "coordinates": {
        "lat": -26.2041,
        "lng": 28.0473
      }
    },
    {
      "id": "cpt",
      "name": "City of Cape Town",
      "province": "Western Cape",
      "population": 4618000,
      "coordinates": {
        "lat": -33.9249,
        "lng": 18.4241
      }
    }
    // ... 6 more metros
  ]
}
```

### Get Metro Details

Get detailed information for a specific metro.

```http
GET /api/v1/metros/{metro_id}
```

**Path Parameters:**
- `metro_id` (string): Metro identifier (e.g., `jhb`, `cpt`, `ethek`)

**Response:**
```json
{
  "id": "jhb",
  "name": "City of Johannesburg",
  "province": "Gauteng",
  "population": 5635127,
  "coordinates": {
    "lat": -26.2041,
    "lng": 28.0473
  },
  "current_data": {
    "timestamp": 1733404800000,
    "intake": 1972.25,
    "usage": 1579.84,
    "wastage": 392.41,
    "wastagePercentage": 19.9,
    "perCapita": 280.3,
    "stressLevel": "MEDIUM",
    "blockchainHash": "a7b3c8d9e2f1..."
  }
}
```

### Get Metro Water Data

Generate real-time water metrics for a metro.

```http
POST /api/v1/metros/{metro_id}/water-data
```

**Response:**
```json
{
  "metro": "City of Johannesburg",
  "metroId": "jhb",
  "province": "Gauteng",
  "population": 5635127,
  "timestamp": 1733404800000,
  "intake": 1972.25,
  "usage": 1579.84,
  "wastage": 392.41,
  "wastagePercentage": 19.9,
  "perCapita": 280.3,
  "stressLevel": "MEDIUM",
  "blockchainHash": "a7b3c8d9e2f1a4b6c8d3e5f7g9h1i3j5"
}
```

### Get Historical Water Data

Retrieve 7-day historical water metrics for a metro.

```http
GET /api/v1/metros/{metro_id}/historical?days=7
```

**Query Parameters:**
- `days` (integer, optional): Number of days (default: 7, max: 30)

**Response:**
```json
{
  "metro": "City of Johannesburg",
  "period_days": 7,
  "data": [
    {
      "date": "2025-12-05",
      "intake": 1972.25,
      "usage": 1579.84,
      "wastage": 392.41
    },
    // ... 6 more days
  ]
}
```

### Get Multi-Metro Comparison

Compare water metrics across multiple metros.

```http
POST /api/v1/metros/compare
```

**Request Body:**
```json
{
  "metro_ids": ["jhb", "cpt", "ethek"]
}
```

**Response:**
```json
{
  "comparison": [
    {
      "metro": "City of Johannesburg",
      "intake": 1972.25,
      "wastagePercentage": 19.9,
      "perCapita": 280.3,
      "stressLevel": "MEDIUM"
    },
    {
      "metro": "City of Cape Town",
      "intake": 1616.30,
      "wastagePercentage": 22.4,
      "perCapita": 271.5,
      "stressLevel": "MEDIUM"
    },
    {
      "metro": "eThekwini (Durban)",
      "intake": 1396.50,
      "wastagePercentage": 25.8,
      "perCapita": 259.8,
      "stressLevel": "HIGH"
    }
  ],
  "timestamp": 1733404800000
}
```

---

## Claude AI Endpoints

### Get Water Conservation Recommendations

Get AI-powered water conservation recommendations for a metro.

```http
POST /api/v1/claude-ai/recommendations
```

**Request Body:**
```json
{
  "metro_id": "jhb",
  "water_data": {
    "intake": 1972.25,
    "usage": 1579.84,
    "wastage": 392.41,
    "wastagePercentage": 19.9,
    "perCapita": 280.3,
    "stressLevel": "MEDIUM"
  }
}
```

**Response:**
```json
{
  "metro": "City of Johannesburg",
  "priority": "HIGH",
  "recommendations": [
    {
      "title": "Implement Advanced Leak Detection",
      "description": "Deploy acoustic sensors and AI-powered leak detection across distribution network",
      "impact": "15-25 ML/day reduction",
      "cost": "R50-80 million",
      "timeline": "12-18 months",
      "kpis": [
        "Leak detection time <4 hours",
        "Leak repair completion <24 hours"
      ]
    },
    {
      "title": "Smart Meter Rollout",
      "description": "Install smart water meters for real-time monitoring and leak alerts",
      "impact": "10-15 ML/day through early detection",
      "cost": "R120-180 million",
      "timeline": "24-36 months",
      "kpis": [
        "100% smart meter coverage",
        "Customer leak alerts within 1 hour"
      ]
    },
    {
      "title": "Pressure Management Zones",
      "description": "Create pressure management zones to reduce pipe bursts and background leakage",
      "impact": "20-30 ML/day reduction",
      "cost": "R30-50 million per zone",
      "timeline": "6-12 months per zone",
      "kpis": [
        "Pressure maintained 200-400 kPa",
        "Burst frequency reduction 40%"
      ]
    }
  ],
  "potentialSavings": "45-70 ML/day total",
  "roi": "Investment recovered within 3-5 years through water savings",
  "generated_at": "2025-12-05T12:00:00Z"
}
```

---

## Notification Endpoints

### Send Shutdown Notification

Send manual water shutdown notification to a metro.

```http
POST /api/v1/notifications/shutdown
```

**Request Body:**
```json
{
  "metro_id": "jhb",
  "urgency": "high",
  "reason": "Emergency pipe burst repair in Zone 3",
  "estimated_duration": "4 hours",
  "affected_areas": "Sandton, Randburg, Fourways",
  "operator_name": "John Doe"
}
```

**Urgency Levels:** `low`, `medium`, `high`, `critical`

**Response:**
```json
{
  "status": "success",
  "notification_id": "NOTIF-1733404800123",
  "metro": "City of Johannesburg",
  "timestamp": "2025-12-05T12:00:00Z",
  "recipients_notified": [
    "Municipal Water Department",
    "Operations Manager",
    "Field Technicians",
    "Public Communication Office"
  ],
  "message": "Shutdown notification sent successfully"
}
```

### Get Notification History

Retrieve notification history for a metro or all metros.

```http
GET /api/v1/notifications/history?metro_id={metro_id}&limit=10
```

**Query Parameters:**
- `metro_id` (string, optional): Filter by metro
- `limit` (integer, optional): Number of results (default: 10, max: 100)
- `status` (string, optional): Filter by status (`sent`, `pending`, `failed`)

**Response:**
```json
{
  "count": 5,
  "notifications": [
    {
      "id": "NOTIF-1733404800123",
      "metro": "City of Johannesburg",
      "urgency": "high",
      "reason": "Emergency pipe burst repair",
      "status": "sent",
      "timestamp": "2025-12-05T12:00:00Z"
    }
    // ... more notifications
  ]
}
```

### Get Notification Details

Get detailed information about a specific notification.

```http
GET /api/v1/notifications/{notification_id}
```

**Response:**
```json
{
  "id": "NOTIF-1733404800123",
  "metro": "City of Johannesburg",
  "urgency": "high",
  "reason": "Emergency pipe burst repair in Zone 3",
  "estimated_duration": "4 hours",
  "affected_areas": "Sandton, Randburg, Fourways",
  "operator_name": "John Doe",
  "status": "sent",
  "timestamp": "2025-12-05T12:00:00Z",
  "recipients": [
    {
      "type": "Municipal Water Department",
      "contact": "water@joburg.gov.za",
      "status": "delivered"
    },
    {
      "type": "Operations Manager",
      "contact": "ops@joburg.gov.za",
      "status": "delivered"
    }
  ]
}
```

---

## Blockchain Verification Endpoints

### Verify Data Integrity

Verify blockchain hash for water data integrity.

```http
POST /api/v1/blockchain/verify
```

**Request Body:**
```json
{
  "metro_id": "jhb",
  "timestamp": 1733404800000,
  "data": {
    "intake": 1972.25,
    "usage": 1579.84,
    "wastage": 392.41
  },
  "blockchain_hash": "a7b3c8d9e2f1a4b6c8d3e5f7g9h1i3j5"
}
```

**Response:**
```json
{
  "verified": true,
  "message": "Data integrity verified successfully",
  "hash": "a7b3c8d9e2f1a4b6c8d3e5f7g9h1i3j5",
  "algorithm": "SHA-256",
  "timestamp": "2025-12-05T12:00:00Z"
}
```

### Get Blockchain Chain

Retrieve the blockchain chain for audit purposes.

```http
GET /api/v1/blockchain/chain?limit=100
```

**Query Parameters:**
- `limit` (integer, optional): Number of blocks (default: 100)

**Response:**
```json
{
  "total_blocks": 150,
  "chain": [
    {
      "index": 149,
      "timestamp": 1733404800000,
      "data": {
        "metro": "City of Johannesburg",
        "intake": 1972.25
      },
      "previous_hash": "b8c4d1e3f5g7h9i2j4k6...",
      "hash": "a7b3c8d9e2f1a4b6c8d3e5f7g9h1i3j5"
    }
    // ... more blocks
  ],
  "verified": true
}
```

---

## Status Codes

| Code | Description |
|------|-------------|
| `200 OK` | Request successful |
| `201 Created` | Resource created successfully |
| `400 Bad Request` | Invalid request data |
| `404 Not Found` | Resource not found |
| `422 Unprocessable Entity` | Validation error |
| `500 Internal Server Error` | Server error |
| `503 Service Unavailable` | Service temporarily unavailable |

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "detail": "Error message describing what went wrong"
}
```

**Example Error:**
```json
{
  "detail": "Metro with ID 'invalid_id' not found"
}
```

---

## Examples

### Complete Workflow: Select Metro, Get Data, Export

```bash
# 1. Get all metros
curl http://localhost:8000/api/v1/metros/

# 2. Get water data for Johannesburg
curl -X POST http://localhost:8000/api/v1/metros/jhb/water-data

# 3. Get Claude AI recommendations
curl -X POST http://localhost:8000/api/v1/claude-ai/recommendations \
  -H "Content-Type: application/json" \
  -d '{
    "metro_id": "jhb",
    "water_data": {
      "intake": 1972.25,
      "usage": 1579.84,
      "wastage": 392.41,
      "wastagePercentage": 19.9,
      "perCapita": 280.3,
      "stressLevel": "MEDIUM"
    }
  }'

# 4. Send shutdown notification
curl -X POST http://localhost:8000/api/v1/notifications/shutdown \
  -H "Content-Type: application/json" \
  -d '{
    "metro_id": "jhb",
    "urgency": "high",
    "reason": "Emergency maintenance",
    "estimated_duration": "2 hours",
    "affected_areas": "CBD",
    "operator_name": "John Doe"
  }'
```

### Multi-Metro Comparison

```bash
curl -X POST http://localhost:8000/api/v1/metros/compare \
  -H "Content-Type: application/json" \
  -d '{
    "metro_ids": ["jhb", "cpt", "ethek", "tshwane"]
  }'
```

---

## Interactive API Documentation

For interactive API documentation with try-it-now functionality, visit:

- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`

---

## Rate Limiting

**Current:** No rate limiting (development mode)

**Production:** Rate limiting will be implemented:
- 100 requests per minute per IP
- 1000 requests per hour per IP
- Contact support for higher limits

---

## CORS Configuration

**Allowed Origins (Development):**
- `http://localhost:3000`
- `http://localhost:3001`
- `http://localhost:3002`
- `http://localhost:8000`

**Production:** Configure specific domains in `.env` file

---

## WebSocket (Future)

Real-time updates via WebSocket will be implemented in Phase 2:

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/metro-updates');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Real-time update:', data);
};
```

---

## Support

For API support and questions:
- **GitHub Issues:** https://github.com/KingsmanRon/ulwandle/issues
- **Documentation:** See `/docs` folder
- **Email:** support@ulwandle.tech (coming soon)

---

**Last Updated:** 2025-12-05
**API Version:** 1.0.0
