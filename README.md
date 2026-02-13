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

### 🗺️ **Interactive South Africa Map (Phase 1)**
*Clean geographic representation with real-time status*

- **Actual South Africa map image** showing provinces and cities
- **Color-coded metro markers** by water stress level:
  - 🔴 Critical (>40% wastage)
  - 🟠 High (30-40% wastage)
  - 🟡 Medium (20-30% wastage)
  - 🟢 Low (<20% wastage)
- **Click metros to select/deselect** directly from map
- **Minimal circular markers** precisely positioned on actual city locations
- **Clean design** - no labels or hover effects, just the map with markers
- **Real-time updates** when metro data changes
- **Responsive design** for desktop and mobile

### 📍 **Zone-Based Problem Area Visualization (Phase 2)**
*Isolate and prioritize problem areas within each metro*

- **Divide metros into zones** (4-6 zones per metro)
- **Color-coded zone blocks** showing problem severity
- **Priority ranking** by wastage % + active leak count
- **Per-zone metrics:**
  - Population breakdown
  - Daily intake/usage/wastage
  - Active leak indicators
  - Cost impact (R/day)
- **Interactive zone selection** with detailed analysis panels
- **AI-powered recommendations** for each problem area
- **"No Problems" indicator** when zones are healthy

**Example:** Johannesburg divided into North, South, East, West, Central zones - instantly see that "Sandton North" has 32.4% wastage with 2 active leaks (R51k/day loss)

### 🔌 **Interactive Network Graph (Phase 3)**
*Full water distribution network topology with leak detection*

- **Graph visualization** of complete water infrastructure:
  - 🟣 Source nodes (treatment plants)
  - 🔵 Primary distribution junctions
  - 🟢 Secondary distribution junctions
  - ⚠️ Leak indicators on pipe segments
- **Real-time monitoring** at each intersection:
  - Flow rate (ML/day)
  - Pressure (kPa)
  - Sensor status (Online/Offline/Error)
- **Differential flow analysis** for leak detection
- **Click nodes/leaks** for detailed information panels
- **Leak analysis includes:**
  - Estimated loss (ML/day and R/day)
  - AI confidence level (70-95%)
  - Probable cause (pipe burst, corrosion, illegal connection)
  - Urgency level (Routine/Planned/Urgent/Emergency)
  - Affected geographic areas
- **Critical leak summary** with top 3 urgent repairs
- **Network statistics:** Node count, pipe segments, active leaks

**Value:** Instead of "Johannesburg has 19.9% NRW", see "70 ML/day leak between Junction A and Junction B, probable pipe burst, R28k/day loss, repair ROI in 5-11 days"

### 📊 **Multi-Metro Aggregation**
*Combined analysis when multiple metros are selected*

- **Total metrics** across all selected metros:
  - Combined daily intake/usage/wastage
  - Overall stress level indicator
  - Average wastage percentage
  - Total population served
- **Individual breakdowns** showing each metro's contribution
- **Key insights:**
  - Highest/lowest wastage metros
  - Daily water loss value (R)
  - Potential annual savings estimates
- **Comparison metrics** (e.g., "Johannesburg: 53.7% of total intake")

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
│  │ SA Map       │  │ Metro        │  │ Dashboard    │            │
│  │ (Image+SVG)  │  │ Selector     │  │ (Recharts)   │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │ Zone Map     │  │ Network      │  │ Excel Export │            │
│  │ (Phase 2)    │  │ Graph (D3)   │  │ (XLSX)       │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │ Multi-Metro  │  │ Shutdown     │  │ Claude AI    │            │
│  │ Aggregate    │  │ Notifications│  │ Rec's        │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                     │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ REST API
                                 │
┌────────────────────────────────▼────────────────────────────────────┐
│                      BACKEND (FastAPI)                              │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │ Water        │  │ Metro        │  │ Network      │            │
│  │ Service      │  │ Service      │  │ Topology Gen │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │ Leak         │  │ Notification │  │ Claude AI    │            │
│  │ Detection    │  │ Service      │  │ Integration  │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                     │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────┐
│              DATABASE (PostgreSQL + TimescaleDB)                    │
│                                                                     │
│  - metros                  - metro_zones             - audit_logs  │
│  - water_intersections     - intersection_readings   (hypertable)  │
│  - intersection_connections - network_leak_detections              │
│  - notifications           - blockchain_records                    │
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

### 1. View South Africa Map
- Clean map image shows all 8 metros with circular markers
- Markers color-coded by water stress level
- Click metros directly on map to select
- Minimal design with accurate city positioning
- Selected metros remain visually clickable

### 2. Select Metros
- Click on one or multiple metro cards
- **OR** click metros directly on the map
- Selected metros show checkmarks
- See selection count in header
- Use "Clear All" to deselect

### 3. View Multi-Metro Aggregation
- Automatically displays when 2+ metros selected
- See combined totals and averages
- Individual metro breakdowns with percentages
- Key insights: highest/lowest wastage
- Potential savings calculations

### 4. View Dashboard
- Automatically displays after metro selection
- See real-time water metrics
- View 7-day historical trends
- Check water stress levels
- Compare intake vs usage

### 5. Explore Problem Areas (Zones)
- View metro divided into geographic zones
- Color-coded by problem severity
- Click zones for detailed analysis
- See priority ranking of problem areas
- Get AI recommendations per zone
- Estimate cost impact (R/day) per zone

### 6. Analyze Network Topology
- Interactive graph of water distribution network
- See source → primary → secondary junctions
- Identify leak locations on pipe segments
- Click nodes for flow/pressure details
- Click leaks for AI analysis
- View critical leak summary with costs

### 7. Export to Excel
- Select one or more metros
- Click "Export to Excel" button
- File downloads automatically
- All selected metros in one spreadsheet

### 8. Create Shutdown Notification
- Select urgency level
- Enter shutdown reason
- Specify estimated duration
- Add affected areas (optional)
- Send notification to all stakeholders
- View notification history

### 9. Get AI Recommendations
- Automatically generated after metro selection
- Review priority level
- Analyze cost-benefit for each recommendation
- Check implementation timeline
- View KPIs and expected impact

### 10. Quick Navigation
- Use sticky nav bar to jump between sections
- Dynamic sections (Problem Areas, Network Graph appear when metro selected)
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

### ✅ Phase 1 - COMPLETED
- ✅ **South Africa Map** - Interactive SVG map with metro highlighting
- ✅ **Zone Visualization** - Problem area isolation and prioritization
- ✅ **Network Graph** - Full topology with leak detection
- ✅ **Multi-Metro Aggregation** - Combined analysis and comparison
- ✅ **Differential Flow Analysis** - Leak detection algorithm
- ✅ **AI Leak Analysis** - Cause identification and cost estimation

### Phase 2 (Next 3-6 Months)
- 🔄 **Real IoT Sensor Integration** - Replace simulated with actual sensors
- 🔄 **Dam Level Monitoring** - Full/low dam alerts and integration
- 📱 **Mobile Apps** - Native iOS/Android apps
- 🚨 **Automated Alerts** - Threshold-based email/SMS notifications

### Phase 3 (Months 7-12)
- 🔮 **Predictive Analytics** - ML-based leak prediction
- 🎯 **Repair Team Dispatch** - Automated work order creation
- 📊 **Historical Trend Analysis** - Long-term leak patterns

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
