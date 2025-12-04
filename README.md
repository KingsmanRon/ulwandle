# 🌊 Ulwandle Tech - Water Monitoring System

**Resource Allocation & Compliance (RAC)**
*Built for South Africa's 8 Metropolitan Municipalities*

[![Built with React](https://img.shields.io/badge/React-18.2-61dafb?logo=react)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14-336791?logo=postgresql)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9-3178c6?logo=typescript)](https://www.typescriptlang.org/)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Screenshots](#screenshots)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Documentation](#documentation)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 Overview

Ulwandle Tech is a comprehensive water monitoring and management platform designed specifically for South Africa's 8 metropolitan municipalities. The system provides real-time water metrics, AI-powered conservation recommendations, blockchain-verified data integrity, and Excel export capabilities for compliance reporting.

### Why Ulwandle Tech?

- **🚰 High Water Wastage:** South African metros lose 15-35% of water to Non-Revenue Water (NRW)
- **💧 Infrastructure Challenges:** Aging pipes, leaks, and burst mains affect millions
- **📊 Data Fragmentation:** No unified monitoring system across metros
- **⚠️ Manual Operations:** Water shutdowns require manual coordination
- **🔒 Compliance Needs:** World Bank PforR requires verified, auditable data

**Ulwandle Tech solves these challenges with one unified platform.**

---

## ✨ Key Features

### 🏙️ **Multi-Metro Monitoring**
- Monitor all 8 South African metropolitan municipalities
- Real-time water metrics for each metro
- Multi-select capability for comparison analysis
- Coverage: 23+ million residents

**8 Metros Supported:**
1. City of Johannesburg (5.6M)
2. City of Cape Town (4.6M)
3. Ekurhuleni (3.8M)
4. eThekwini - Durban (4.0M)
5. City of Tshwane - Pretoria (3.3M)
6. Nelson Mandela Bay (1.3M)
7. Buffalo City (832K)
8. Mangaung - Bloemfontein (783K)

### 📈 **Comprehensive Water Metrics**
- **Daily Water Intake** - Megalitres from sources
- **Actual Usage** - Water delivered to consumers
- **Wastage (NRW)** - Non-Revenue Water losses
- **Per Capita Usage** - Liters per person per day
- **Water Stress Levels** - Critical/High/Medium/Low indicators
- **7-Day Historical Trends** - Visual analytics with charts

### 📊 **Multi-Metro Excel Export**
- Select one or multiple metros
- Export all selected metros to single Excel file
- Auto-sized columns for readability
- Timestamped filenames
- Smart filename generation:
  - Single metro: `City_of_Johannesburg_Water_Data_timestamp.xlsx`
  - Multiple: `SA_Metros_Water_Data_3_Metros_timestamp.xlsx`

### 🚨 **Manual Shutdown Notification System**
*Critical for South African water management where shutdowns are manual*

- Create shutdown notices per metro
- Urgency levels: Low, Medium, High, Critical
- Document reason, duration, affected areas
- Notification history tracking
- Status monitoring (Sent/Pending/Failed)

**Recipients:**
- Municipal Water Department
- Operations Manager
- Field Technicians
- Public Communication Office

### 🤖 **AI-Powered Conservation Recommendations**
*Powered by Claude AI (Anthropic)*

- Priority-based recommendations (Critical/High/Medium)
- Implementation timelines and cost estimates
- Key Performance Indicators (KPIs)
- ROI calculations
- Specific interventions:
  - Advanced leak detection systems
  - Smart meter rollout
  - Pressure management zones

### 🔒 **Blockchain Data Integrity**
- SHA-256 cryptographic hashing
- Immutable data verification
- Audit trail for compliance
- World Bank PforR compliant
- Blockchain-verified exports

### 🎯 **Quick Navigation**
- Sticky navigation bar
- One-click section jumping
- Smooth scrolling
- Mobile-responsive
- Always accessible

### 📱 **Progressive Web App (PWA)**
- Install on desktop or mobile
- Offline capability
- Fast load times
- Native app experience
- Auto-update mechanism

---

## 📸 Screenshots

### Metro Selection
*Select multiple metros with visual checkmarks and selection counter*

### Dashboard
*Real-time metrics with pie charts, area charts, and stress indicators*

### Excel Export
*Smart export system with helper text and multi-metro support*

### AI Recommendations
*Claude AI-powered conservation strategies with cost-benefit analysis*

### Shutdown Notifications
*Complete notification system for manual water shutdowns*

---

## 🏗️ Architecture

### High-Level Architecture

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

For detailed architecture diagrams, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## 🛠️ Technology Stack

### Frontend
- **React** 18.2 with TypeScript 4.9
- **Recharts** 3.5 - Data visualization
- **Lucide React** - Icon library
- **XLSX (SheetJS)** 0.18 - Excel export
- **Axios** - HTTP client
- **PWA** - Service workers & manifest

### Backend
- **FastAPI** - Modern Python web framework
- **PostgreSQL** 14 - Relational database
- **TimescaleDB** - Time-series extension
- **SQLAlchemy** 2.0 - ORM
- **Pydantic** v2 - Data validation
- **Uvicorn** - ASGI server

### Security & AI
- **SHA-256** - Blockchain hashing
- **Claude AI** (Anthropic) - AI recommendations
- **CORS** - Cross-origin security
- **python-dotenv** - Environment management

### DevOps
- **Docker** + Docker Compose
- **Git** + GitHub
- **Node.js** 18+
- **Python** 3.9+

---

## 🚀 Getting Started

### Prerequisites

- **Docker** & **Docker Compose** (recommended)
- **Node.js** 18+ and npm
- **Python** 3.9+
- **PostgreSQL** 14+ (if not using Docker)
- **Anthropic API Key** for Claude AI (optional)

### Quick Start with Docker

```bash
# 1. Clone the repository
git clone https://github.com/KingsmanRon/ulwandle.git
cd ulwandle

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your configuration (optional for basic usage)

# 3. Start all services
docker-compose up -d

# 4. Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Development Setup (Without Docker)

#### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your database URL and API keys

# Run database migrations (if applicable)
# alembic upgrade head

# Start the backend server
uvicorn app.main:app --reload --port 8000
```

Backend will be available at `http://localhost:8000`

#### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm start
```

Frontend will be available at `http://localhost:3000`

**Note:** Make sure the backend is running before starting the frontend, or update the API URL in the frontend configuration.

---

## 💡 Usage

### 1. Select Metros
- Click on one or multiple metro cards
- Selected metros show checkmarks
- See selection count in header
- Use "Clear All" to deselect

### 2. View Dashboard
- Automatically displays after metro selection
- See real-time water metrics
- View 7-day historical trends
- Check water stress levels
- Compare intake vs usage

### 3. Export to Excel
- Select one or more metros
- Click "Export to Excel" button
- File downloads automatically
- All selected metros in one spreadsheet

### 4. Create Shutdown Notification
- Select urgency level
- Enter shutdown reason
- Specify estimated duration
- Add affected areas (optional)
- Send notification to all stakeholders
- View notification history

### 5. Get AI Recommendations
- Automatically generated after metro selection
- Review priority level
- Analyze cost-benefit for each recommendation
- Check implementation timeline
- View KPIs and expected impact

### 6. Quick Navigation
- Use sticky nav bar to jump between sections
- Click to smooth scroll
- Always visible while scrolling

---

## 📚 Documentation

Comprehensive documentation is available in the `/docs` folder:

- **[PRESENTATION.md](docs/PRESENTATION.md)** - 22-slide PowerPoint outline for stakeholders
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Detailed ASCII architecture diagrams
- **[FEATURE_ROADMAP.md](docs/FEATURE_ROADMAP.md)** - Future enhancements and nice-to-have features

### API Documentation

When running the backend, interactive API documentation is available:
- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`

---

## 🗺️ Roadmap

### Phase 2 (Next 3 Months)
- ✅ **Dam Level Monitoring** - Full/low dam alerts and integration
- ✅ **Real-time IoT Sensors** - Connect actual flow meters and sensors
- ✅ **Interactive Maps** - Leaflet/Mapbox visualization of all metros

### Phase 3 (Months 4-6)
- 📱 **Mobile Apps** - Native iOS/Android apps
- 🚨 **Automated Alerts** - Threshold-based email/SMS notifications
- 🔮 **Predictive Analytics** - ML-based forecasting

### Phase 4 (Months 7-12)
- 👥 **Citizen Reporting** - Public portal for leak reports
- 🔌 **Public API** - Third-party developer access
- 💧 **Inter-Metro Transfers** - Water sharing coordination
- 📊 **Advanced BI** - PowerBI/Tableau integration

### Future Innovations
- 🤖 **ML Leak Detection** - AI-powered acoustic analysis
- 🏗️ **Digital Twin** - Virtual network simulation
- 💎 **Blockchain Credits** - Tokenized water savings
- 🌡️ **Climate Modeling** - Long-term impact analysis

See [docs/FEATURE_ROADMAP.md](docs/FEATURE_ROADMAP.md) for detailed feature descriptions and priorities.

---

## 🤝 Contributing

We welcome contributions from the community! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/AmazingFeature`)
3. **Commit your changes** (`git commit -m 'Add some AmazingFeature'`)
4. **Push to the branch** (`git push origin feature/AmazingFeature`)
5. **Open a Pull Request**

### Development Guidelines
- Follow TypeScript/Python best practices
- Write tests for new features
- Update documentation
- Ensure code passes linting
- Keep commits atomic and descriptive

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🏛️ Compliance

Ulwandle Tech is designed to comply with:
- **World Bank Program-for-Results (PforR)** - Blockchain-verified data
- **SANS 241** - Drinking water standards (future)
- **Water Services Act** (Act No. 108 of 1997)
- **National Water Act** (Act No. 36 of 1998)
- **Municipal Systems Act** (Act No. 32 of 2000)

---

## 🙏 Acknowledgments

- **South African Metros** - For their commitment to water conservation
- **Department of Water and Sanitation (DWS)** - Policy guidance
- **World Bank** - Program-for-Results framework
- **Anthropic** - Claude AI capabilities
- **Open Source Community** - For amazing tools and libraries

---

## 📞 Support

For support, questions, or feature requests:

- **Issues:** [GitHub Issue Tracker](https://github.com/KingsmanRon/ulwandle/issues)
- **Email:** support@ulwandle.tech (coming soon)
- **Documentation:** See `/docs` folder

---

## 🌟 Star Us!

If you find Ulwandle Tech useful, please consider giving it a ⭐ on GitHub!

---

**Built with 💙 for South Africa's Water Infrastructure**

*Powered by Claude AI | Program-for-Results*

---

## 📊 Project Stats

- **8 Metros** - Full coverage of SA metropolitan municipalities
- **23M+ People** - Combined population served
- **15-35%** - Water wastage reduction target
- **React 18** - Modern frontend framework
- **FastAPI** - High-performance Python backend
- **PostgreSQL + TimescaleDB** - Robust data storage
- **SHA-256** - Blockchain integrity verification
