# Ulwandle Tech - Setup Guide

## Quick Start

### Prerequisites

1. **Docker & Docker Compose** (recommended)
2. **Python 3.11+** (for local development)
3. **Node.js 18+** (for frontend development)
4. **Anthropic API Key** for Claude AI

### Step 1: Get Claude API Key

1. Sign up at https://console.anthropic.com/
2. Create an API key
3. Copy the key (starts with `sk-ant-api03-...`)

### Step 2: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your Claude API key
nano .env
# Set: ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

### Step 3: Start with Docker (Recommended)

```bash
# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f backend

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
# Grafana: http://localhost:3001
```

### Step 4: Initialize Database

The database will be automatically initialized with sample data when the containers start.

### Step 5: Test the System

1. Open http://localhost:3000 in your browser
2. You should see the Ulwandle Tech dashboard
3. Navigate through different sections:
   - Dashboard (overview)
   - Districts (all districts)
   - Water Quality (pH/TDS monitoring)
   - Kill Switch (valve control)
   - AI Predictions (Claude-powered analytics)
   - Alerts (system notifications)

## Local Development (Without Docker)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start PostgreSQL locally or use Docker
docker run -d -p 5432:5432 \
  -e POSTGRES_USER=ulwandle \
  -e POSTGRES_PASSWORD=ulwandle_password \
  -e POSTGRES_DB=ulwandle_db \
  timescale/timescaledb:latest-pg15

# Run migrations (create tables)
python -c "from app.db.database import engine, Base; from app.models.models import *; Base.metadata.create_all(bind=engine)"

# Start the backend server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start

# Frontend will open at http://localhost:3000
```

## Testing Claude AI Integration

### Test Water Consumption Analysis

```bash
curl -X POST http://localhost:8000/api/v1/predictions/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "district_id": 1,
    "prediction_type": "consumption",
    "horizon": "24h",
    "historical_hours": 168
  }'
```

### Test Water Quality Analysis

```bash
curl -X POST http://localhost:8000/api/v1/water-quality/analyze/1?hours=24
```

### Test Kill Switch (Valve Operation)

```bash
curl -X POST http://localhost:8000/api/v1/kill-switch/valves/VALVE-0001/operate \
  -H "Content-Type: application/json" \
  -d '{
    "action": "close",
    "operator_name": "John Doe",
    "reason": "Maintenance required",
    "is_manual": true
  }'
```

## Key Features Implementation

### 1. Water Loss Detection
- **Location**: `backend/app/api/monitoring.py`
- **Function**: `check_flow_anomaly()`
- Automatically detects anomalies using statistical analysis

### 2. Kill Switch (Remote Valve Control)
- **Location**: `backend/app/api/kill_switch.py`
- **Endpoint**: `POST /api/v1/kill-switch/valves/{valve_id}/operate`
- Includes AI safety analysis before operation

### 3. pH/TDS Monitoring
- **Location**: `backend/app/api/water_quality.py`
- **Standards**: SANS 241 compliance
- Real-time water quality assessment

### 4. Red-Flagged Districts
- **Location**: `backend/app/api/districts.py`
- **Endpoint**: `GET /api/v1/districts/red-flagged/list`
- Tracks districts with undrinkable water

### 5. Predictive Consumption
- **Location**: `backend/app/api/predictions.py`
- **Claude Integration**: `backend/app/services/claude_service.py`
- AI-powered consumption forecasting

### 6. Real-time Notifications
- **Location**: `backend/app/services/websocket_manager.py`
- **WebSocket**: `ws://localhost:8000/ws/{client_id}`
- Instant alerts to employees

## API Documentation

Once running, access the complete API documentation at:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Ulwandle Tech Platform                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   IoT Layer  │───▶│  API Layer   │───▶│  AI/ML Layer │  │
│  │              │    │   (FastAPI)  │    │   (Claude)   │  │
│  │ - Sensors    │    │              │    │              │  │
│  │ - Flow       │    │ - REST API   │    │ - Predictions│  │
│  │ - pH/TDS     │    │ - WebSocket  │    │ - Anomalies  │  │
│  │ - Valves     │    │ - Auth       │    │ - Analysis   │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                    │                    │          │
│         ▼                    ▼                    ▼          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         PostgreSQL + TimescaleDB (Time-series)      │   │
│  └─────────────────────────────────────────────────────┘   │
│                             │                                │
│                             ▼                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              React Dashboard (Frontend)              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## South Africa Compliance

This system complies with:
- **SANS 241**: Drinking water standards
- **Water Services Act** (Act No. 108 of 1997)
- **National Water Act** (Act No. 36 of 1998)
- **Municipal Systems Act** (Act No. 32 of 2000)

## Troubleshooting

### Backend won't start
- Check if PostgreSQL is running: `docker-compose ps`
- Check logs: `docker-compose logs backend`
- Verify Claude API key is set in `.env`

### Frontend won't connect to backend
- Verify backend is running on port 8000
- Check CORS settings in `backend/app/main.py`
- Check `.env` file has correct `REACT_APP_API_URL`

### Claude AI not working
- Verify API key is correct
- Check backend logs for API errors
- Ensure you have API credits available

### Database errors
- Reset database: `docker-compose down -v && docker-compose up -d`
- Check TimescaleDB is properly initialized

## Production Deployment

For production deployment:

1. **Security**:
   - Change all default passwords
   - Use strong `SECRET_KEY`
   - Enable HTTPS/TLS
   - Restrict CORS origins

2. **Database**:
   - Use managed PostgreSQL/TimescaleDB
   - Enable automated backups
   - Set up replication

3. **Monitoring**:
   - Configure Prometheus alerts
   - Set up Grafana dashboards
   - Enable application logging

4. **Scaling**:
   - Use load balancer for API
   - Scale backend horizontally
   - Use CDN for frontend

## Support

For issues, questions, or contributions:
- GitHub Issues: https://github.com/KingsmanRon/ulwandle/issues
- Email: support@ulwandle.tech

## License

MIT License - See LICENSE file for details

---

**Built for South Africa's water infrastructure** 🇿🇦 💧
