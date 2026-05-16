# Ulwandle Tech — Resource Allocation & Compliance (RAC)

**Compliance-grade water-loss reporting, live dam levels, and AI-driven
action plans for South African metros.**

South African municipalities lose roughly **47% of treated water** before it
reaches a paying customer — somewhere in the order of **R17 billion per year**
across the eight metros, on a R12/kL replacement-cost basis. Ulwandle RAC
turns that number into a daily, sourced, auditable dashboard, and a
Claude-generated action plan a city manager can act on this week.

![Ulwandle RAC dashboard](docs/dashboard-preview.svg)

---

## Why a buyer cares

- **One headline number, on day one.** The dashboard opens with the estimated
  rand-value of non-revenue water across your portfolio. The assumption (tariff
  × population × per-capita × NRW%) is shown inline and editable.
- **Every figure is sourced.** Population from Stats SA Census 2022. NRW from
  DWS Drop reports. Dam levels scraped daily from capetown.gov.za and weekly
  from dws.gov.za — refresh timestamps visible to the operator.
- **Compliance-ready exports.** SANS 241 quality dashboard and a one-click
  World Bank Program-for-Results compliance report.
- **Safe by construction.** Dual-control, Ed25519-signed kill-switch
  operations; HMAC-gated sensor ingestion; rate-limited valve API; full audit
  trail. Built so a procurement reviewer can sign off.
- **Deployable in a day.** Free-tier-friendly: Vercel + Render + Neon +
  Upstash + Anthropic. See [`DEPLOY.md`](DEPLOY.md).

## Who it's for

- **Municipal water utilities** running 100k+ connections that need defensible
  NRW reporting and want to move from spreadsheets to a live system.
- **National and provincial water departments** (DWS, provincial COGTAs) that
  need a portfolio view across metros.
- **Multilateral funders** (World Bank PforR, AFD, AfDB) that require
  outcome-linked, audited compliance evidence.

## Try the live demo

A staging instance runs on Vercel + Render free tiers — see
[`DEPLOY.md`](DEPLOY.md) to spin up your own copy (15-minute walkthrough),
or contact us for read-only credentials on the hosted demo.

---

## Feature detail

### Water-loss detection
- Real-time flow monitoring across the distribution network
- AI-powered leak detection using pattern analysis
- Automated alerts for abnormal consumption patterns
- Historical data analysis for loss quantification

### Kill switch (remote valve control)
- Remote valve control for emergency shutoffs
- Dual-control approval with Ed25519 signatures and TTL'd proposals
- Pump control for high-pressure areas
- Full audit trail for every valve operation

### Water-quality monitoring
- Real-time pH and TDS (Total Dissolved Solids) monitoring
- Automated quality alerts for red-flagged districts
- Compliance tracking against SANS 241 drinking-water standards

### Red-flagged districts
- District-level water-quality classification
- Automated alerts when water becomes non-compliant
- Compliance reporting for regulatory bodies

### Predictive consumption (Claude-powered)
- Per-metro Claude recommendations: priority, items, potential savings, ROI
- Pattern recognition for leak detection
- Demand forecasting and seasonal trend analysis

### Smart-grid monitoring
- Real-time pressure monitoring
- Flow-rate tracking across zones
- Network health visualization

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
