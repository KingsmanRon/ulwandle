# Ulwandle Tech - Resource Allocation & Compliance (RAC)

## Smart Water Monitoring System for South Africa

**Tagline:** Resource Allocation & Compliance (RAC)
**Program:** South Africa Program-for-Results

---

## Overview

Ulwandle Tech is an intelligent water monitoring and management system designed for South African municipalities. The system provides real-time monitoring, AI-powered predictive analytics, and automated control for water distribution networks.

## Key Features

### 1. **Water Loss Detection**
- Real-time flow monitoring across the distribution network
- AI-powered leak detection using pattern analysis
- Automated alerts for abnormal consumption patterns
- Historical data analysis for loss quantification

### 2. **Kill Switch (Remote Valve Control)**
- Remote valve control for emergency shutoffs
- Automated notifications to field employees
- GPS-based employee dispatch for manual interventions
- Pump control for high-pressure areas
- Audit trail for all valve operations

### 3. **Water Quality Monitoring**
- Real-time pH and TDS (Total Dissolved Solids) monitoring
- Automated quality alerts for red-flagged districts
- Compliance tracking with SANS 241 drinking water standards
- Quality trend analysis and predictions

### 4. **Red-Flagged Districts**
- District-level water quality classification
- Automated alerts when water becomes undrinkable
- Public notification system integration
- Compliance reporting for regulatory bodies

### 5. **Predictive Consumption (Pattern Analysis)**
- AI/ML-powered consumption prediction using Claude API
- Pattern recognition for leak detection
- Demand forecasting for capacity planning
- Anomaly detection for early warning
- Seasonal trend analysis

### 6. **Smart Grid Monitoring**
- Real-time pressure monitoring
- Flow rate tracking across zones
- Network health visualization
- Infrastructure maintenance scheduling

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Ulwandle Tech Platform                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   IoT Layer  │───▶│  API Layer   │───▶│  AI/ML Layer │  │
│  │              │    │              │    │   (Claude)   │  │
│  │ - Sensors    │    │ - REST API   │    │              │  │
│  │ - Flow       │    │ - WebSocket  │    │ - Predictions│  │
│  │ - pH/TDS     │    │ - Auth       │    │ - Anomalies  │  │
│  │ - Valves     │    │              │    │ - Analysis   │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                    │                    │          │
│         ▼                    ▼                    ▼          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              PostgreSQL + TimescaleDB               │   │
│  │        (Time-series Data & Configuration)           │   │
│  └─────────────────────────────────────────────────────┘   │
│                             │                                │
│                             ▼                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Frontend Dashboard (React)              │   │
│  │                                                       │   │
│  │  - Real-time Monitoring    - Alert Management       │   │
│  │  - Kill Switch Control     - Quality Dashboard      │   │
│  │  - Predictive Analytics    - District Status        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

- **Backend:** Python 3.11+ with FastAPI
- **Database:** PostgreSQL 15 with TimescaleDB extension
- **AI/ML:** Claude API (Anthropic)
- **Frontend:** React 18 with TypeScript
- **Real-time:** WebSockets for live updates
- **Deployment:** Docker & Docker Compose
- **Monitoring:** Prometheus & Grafana

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Anthropic API Key (Claude)
- Python 3.11+
- Node.js 18+

### Installation

```bash
# Clone the repository
git clone https://github.com/KingsmanRon/ulwandle.git
cd ulwandle

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start the application
docker-compose up -d

# Access the dashboard
open http://localhost:3000
```

### Development Setup

```bash
# Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend setup
cd frontend
npm install
npm start
```

## API Documentation

Once running, access the API documentation at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Configuration

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ulwandle

# Claude API
ANTHROPIC_API_KEY=your_api_key_here

# Application
APP_ENV=production
SECRET_KEY=your_secret_key

# Alerts
ALERT_EMAIL=alerts@ulwandle.tech
SMS_API_KEY=your_sms_api_key
```

## South Africa Compliance

This system is designed to comply with:
- SANS 241: Drinking water standards
- Water Services Act (Act No. 108 of 1997)
- National Water Act (Act No. 36 of 1998)
- Municipal Systems Act (Act No. 32 of 2000)

## Project Structure

```
ulwandle/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/            # API endpoints
│   │   ├── core/           # Core configuration
│   │   ├── models/         # Database models
│   │   ├── services/       # Business logic
│   │   └── ai/             # Claude AI integration
│   └── requirements.txt
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   └── utils/          # Utilities
│   └── package.json
├── database/               # Database migrations
├── docker-compose.yml      # Docker orchestration
└── docs/                   # Documentation
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Email: support@ulwandle.tech
- Documentation: https://docs.ulwandle.tech
- Issue Tracker: https://github.com/KingsmanRon/ulwandle/issues

## Acknowledgments

- South African Department of Water and Sanitation
- Municipal partners across South Africa
- Anthropic for Claude AI capabilities

---

**Built with ❤️ for South Africa's water infrastructure**
