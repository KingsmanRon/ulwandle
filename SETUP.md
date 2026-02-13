# Ulwandle Tech - Setup Guide

## Quick Start

### Prerequisites

1. **Docker & Docker Compose** (recommended)
2. **Python 3.9+** (for local development)
3. **Node.js 18+** (for frontend development)
4. **Anthropic API Key** for Claude AI (optional for basic usage)

### Step 1: Get Claude API Key (Optional)

The system works without an API key, but AI-powered recommendations require one:

1. Sign up at https://console.anthropic.com/
2. Create an API key
3. Copy the key (starts with `sk-ant-api03-...`)

### Step 2: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your Claude API key (optional)
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
```

### Step 4: Initialize Database

The database will be automatically initialized when the containers start.

### Step 5: Test the System

1. Open http://localhost:3000 in your browser
2. You should see the Ulwandle Tech dashboard
3. Navigate through different sections:
   - **Select Metro** - Choose one or multiple metros
   - **Dashboard** - View real-time water metrics and 7-day trends
   - **Shutdown Notice** - Send manual water shutdown notifications
   - **AI Recommendations** - Get Claude AI-powered conservation strategies
   - **Excel Export** - Download water data for selected metros

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
  postgres:14

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

## Testing the Application

### Test Metro Selection and Data Generation

1. Open http://localhost:3000
2. Select one or more metros (e.g., City of Johannesburg, City of Cape Town)
3. View real-time water metrics:
   - Daily Water Intake (megalitres)
   - Actual Usage (megalitres)
   - Wastage/NRW (megalitres and percentage)
   - Per Capita Usage (liters per person per day)
   - Water Stress Level

### Test Multi-Metro Comparison

```bash
curl -X POST http://localhost:8000/api/v1/metros/compare \
  -H "Content-Type: application/json" \
  -d '{
    "metro_ids": ["jhb", "cpt", "ethek"]
  }'
```

### Test Shutdown Notification

```bash
curl -X POST http://localhost:8000/api/v1/notifications/shutdown \
  -H "Content-Type: application/json" \
  -d '{
    "metro_id": "jhb",
    "urgency": "high",
    "reason": "Emergency pipe burst repair",
    "estimated_duration": "4 hours",
    "affected_areas": "Sandton, Randburg",
    "operator_name": "John Doe"
  }'
```

### Test Claude AI Recommendations

```bash
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
```

### Test Blockchain Verification

```bash
curl -X POST http://localhost:8000/api/v1/blockchain/verify \
  -H "Content-Type: application/json" \
  -d '{
    "metro_id": "jhb",
    "timestamp": 1733404800000,
    "data": {
      "intake": 1972.25,
      "usage": 1579.84,
      "wastage": 392.41
    },
    "blockchain_hash": "a7b3c8d9e2f1a4b6c8d3e5f7g9h1i3j5"
  }'
```

## Key Features Implementation

### 1. Multi-Metro Selection
- **Location**: `frontend/src/components/MetroSelector.tsx`
- **Feature**: Select one or multiple metros simultaneously
- Visual checkmarks for selected metros
- Selection counter and "Clear All" button

### 2. Real-Time Water Metrics
- **Location**: `frontend/src/components/MetroDashboard.tsx`
- **Metrics**:
  - Daily Water Intake (megalitres)
  - Actual Usage (megalitres)
  - Wastage/NRW (Non-Revenue Water)
  - Per Capita Usage (liters per person per day)
  - Water Stress Levels (Critical/High/Medium/Low)

### 3. Excel Export
- **Location**: `frontend/src/components/WorldBankCompliance.tsx`
- **Feature**: Export single or multiple metros to Excel
- Smart filename generation
- Auto-sized columns

### 4. Shutdown Notifications
- **Location**: `frontend/src/components/ShutdownNotification.tsx`
- **Endpoint**: `POST /api/v1/notifications/shutdown`
- Create manual water shutdown notices
- Urgency levels: Low, Medium, High, Critical
- Notification history tracking

### 5. AI-Powered Recommendations
- **Location**: `backend/app/api/claude_ai.py`
- **Claude Integration**: `backend/app/services/claude_service.py`
- Conservation strategies with cost-benefit analysis
- Implementation timelines and KPIs

### 6. Blockchain Data Integrity
- **Location**: `frontend/src/services/blockchainService.ts`
- **Algorithm**: SHA-256 cryptographic hashing
- Immutable data verification
- World Bank PforR compliance

### 7. Quick Navigation
- **Location**: `frontend/src/App.tsx`
- Sticky navigation bar
- One-click section jumping
- Smooth scrolling with offset

## API Documentation

Once running, access the complete API documentation at:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **API Docs File**: See `API_DOCUMENTATION.md`

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                │
│                    (Desktop, Mobile, Tablet)                        │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ HTTPS
                                 │
┌────────────────────────────────▼────────────────────────────────────┐
│                     FRONTEND (React PWA)                            │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │ Metro        │  │ Dashboard    │  │ Excel Export │            │
│  │ Selector     │  │ (Recharts)   │  │ (XLSX)       │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │ Shutdown     │  │ Claude AI    │  │ Blockchain   │            │
│  │ Notifications│  │ Rec's        │  │ Service      │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                     │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ REST API
                                 │
┌────────────────────────────────▼────────────────────────────────────┐
│                      BACKEND (FastAPI)                              │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │ Water        │  │ Metro        │  │ Notification │            │
│  │ Service      │  │ Service      │  │ Service      │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐                               │
│  │ Claude AI    │  │ Blockchain   │                               │
│  │ Integration  │  │ Verification │                               │
│  └──────────────┘  └──────────────┘                               │
│                                                                     │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────┐
│              DATABASE (PostgreSQL + TimescaleDB)                    │
│                                                                     │
│  - metros              - notifications       - audit_logs          │
│  - water_readings      - blockchain_records  - claude_cache        │
│  - water_time_series   (TimescaleDB hypertables)                   │
└─────────────────────────────────────────────────────────────────────┘
```

## 8 South African Metropolitan Municipalities

The system supports all 8 SA metros:

1. **City of Johannesburg** (5.6M population) - Gauteng
2. **City of Cape Town** (4.6M) - Western Cape
3. **Ekurhuleni** (3.8M) - Gauteng
4. **eThekwini (Durban)** (4.0M) - KwaZulu-Natal
5. **City of Tshwane (Pretoria)** (3.3M) - Gauteng
6. **Nelson Mandela Bay** (1.3M) - Eastern Cape
7. **Buffalo City** (832K) - Eastern Cape
8. **Mangaung (Bloemfontein)** (783K) - Free State

**Total Coverage**: 23+ million residents

## South Africa Compliance

This system is designed to comply with:
- **World Bank Program-for-Results (PforR)** - Blockchain-verified data
- **Water Services Act** (Act No. 108 of 1997)
- **National Water Act** (Act No. 36 of 1998)
- **Municipal Systems Act** (Act No. 32 of 2000)

## Troubleshooting

### Backend won't start
- Check if PostgreSQL is running: `docker-compose ps`
- Check logs: `docker-compose logs backend`
- Verify environment variables are set in `.env`

### Frontend won't connect to backend
- Verify backend is running on port 8000: `curl http://localhost:8000/api/v1/dashboard/overview`
- Check CORS settings in `backend/app/main.py`
- Ensure API URL is correct in frontend

### Claude AI not working
- Verify API key is correct in `.env`
- Check backend logs for API errors: `docker-compose logs backend`
- Ensure you have API credits available
- **Note**: Basic system works without Claude AI, only AI recommendations require the API key

### Excel export not working
- Check that xlsx library is installed: `npm install`
- Clear node_modules and reinstall: `rm -rf node_modules package-lock.json && npm install`
- Check browser console for errors

### Database errors
- Reset database: `docker-compose down -v && docker-compose up -d`
- Check PostgreSQL logs: `docker-compose logs db`
- Verify database connection string in `.env`

### Scroll alignment issues
- Clear browser cache
- Try hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Check that sticky navigation is working

## Production Deployment

For production deployment:

1. **Security**:
   - Change all default passwords
   - Use strong `SECRET_KEY`
   - Enable HTTPS/TLS
   - Restrict CORS origins to your domain
   - Enable authentication and authorization

2. **Database**:
   - Use managed PostgreSQL service
   - Enable automated backups
   - Set up replication for high availability
   - Configure TimescaleDB for time-series data

3. **Monitoring**:
   - Set up application logging
   - Configure error tracking (e.g., Sentry)
   - Monitor API performance
   - Track water data integrity

4. **Scaling**:
   - Use load balancer for API
   - Scale backend horizontally
   - Use CDN for frontend static assets
   - Optimize database queries and indexing

5. **Backup & Recovery**:
   - Daily database backups
   - Blockchain data preservation
   - Disaster recovery plan
   - Regular backup testing

## Feature Roadmap

See `docs/FEATURE_ROADMAP.md` for planned enhancements including:
- Dam level monitoring and alerts
- Real-time IoT sensor integration
- Predictive analytics
- Interactive map visualization
- Mobile apps (iOS/Android)
- Public API for third parties
- Citizen reporting portal

## Support

For issues, questions, or contributions:
- **GitHub Issues**: https://github.com/KingsmanRon/ulwandle/issues
- **Documentation**: See `/docs` folder
- **Email**: support@ulwandle.tech (coming soon)

## License

MIT License - See LICENSE file for details

---

**Built for South Africa's water infrastructure** 🇿🇦 💧
*Powered by Claude AI | Program-for-Results*
