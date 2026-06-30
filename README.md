# Ulwandle Tech — Resource Allocation & Compliance (RAC)

**Source-backed metro water intelligence, current dam readings, and traceable
data provenance for South African metros.**

South African municipalities lose roughly **47% of treated water** before it
reaches a paying customer — somewhere in the order of **R17 billion per year**
across the eight metros, on a R12/kL replacement-cost basis. Ulwandle RAC
turns those public baselines into a sourced dashboard with freshness indicators
and an advisory action plan.

![Ulwandle RAC dashboard](docs/dashboard-preview.svg)

---

## Why a buyer cares

- **One headline number, on day one.** The dashboard opens with the estimated
  rand-value of non-revenue water across your portfolio. The assumption (tariff
  × population × per-capita × NRW%) is shown inline and editable.
- **Sourced overview figures.** Population, NRW baselines, and dam readings in
  the main overview carry source references and dates. Representative metro,
  zone, and network screens are labelled as illustrative.
- **Truthful demo exports.** Scenario workbooks identify every generated value
  as illustrative and state that they are not valid for W10, W11, PIAP, audit,
  regulatory submission, or independent verification.
- **Operational preview behind a flag.** Sensor ingestion, water quality,
  predictions, and valve controls remain disabled in the production sales demo
  until a municipal integration supplies real telemetry.
- **Deployable in a day.** Free-tier-friendly: Vercel + Render + Neon +
  Upstash + Anthropic. See [`DEPLOY.md`](DEPLOY.md).

## Who it's for

- **Municipal water utilities** that need a traceable path from approved source
  records to defensible NRW reporting.
- **National and provincial water departments** (DWS, provincial COGTAs) that
  need a portfolio view across metros.
- **Implementation partners and assurance teams** that need visible source
  lineage and repeatable evidence workflows.

## Try the live demo

A staging instance runs on Vercel + Render free tiers — see
[`DEPLOY.md`](DEPLOY.md) to spin up your own copy (15-minute walkthrough),
or contact us for read-only credentials on the hosted demo.

---

## Feature detail

### W10 and W11 evidence workspace

The Reports section accepts a twelve month CSV containing system input volume,
billed authorised consumption, total connections, and connections billed from
actual meter readings.

Each import receives a SHA256 source fingerprint and immutable version number.
A different supervisor or administrator must approve the draft. Approval
freezes the deterministic W10 and W11 result and enables a ZIP evidence pack
containing the original source file, source lineage, normalised monthly records,
approval identities, methodology version, and calculations.

The features below are operational scaffolding for a future municipal
integration. They do not represent current telemetry, actuator, or notification
coverage.

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

## South African regulatory context

The product is being designed to support evidence workflows connected to:
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
