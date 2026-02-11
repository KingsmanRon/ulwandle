# Ulwandle Tech - System Architecture
## Detailed ASCII Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    CLIENT LAYER                                             │
│                         (User Devices - Desktop, Mobile, Tablet)                            │
└────────────────────────────────────────┬────────────────────────────────────────────────────┘
                                         │ HTTPS
                                         │
┌────────────────────────────────────────▼────────────────────────────────────────────────────┐
│                              FRONTEND APPLICATION (PWA)                                      │
│                                  Port: 3000 (Dev)                                            │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                            React 18 + TypeScript                                     │   │
│  │                                                                                      │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌─────────────────┐  │   │
│  │  │ ErrorBoundary  │  │  App.tsx       │  │ MetroSelector  │  │ MetroDashboard  │  │   │
│  │  │                │  │                │  │                │  │                 │  │   │
│  │  │ - Error catch  │  │ - State Mgmt   │  │ - Multi-select │  │ - Recharts      │  │   │
│  │  │ - Graceful UI  │  │ - Navigation   │  │ - Toggle       │  │ - Metrics       │  │   │
│  │  │ - Error report │  │ - PWA Setup    │  │ - Checkmarks   │  │ - Pie/Area      │  │   │
│  │  └────────────────┘  └────────────────┘  └────────────────┘  └─────────────────┘  │   │
│  │                                                                                      │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌─────────────────┐  │   │
│  │  │ WorldBank      │  │  Shutdown      │  │ Claude Rec's   │  │ Service Workers │  │   │
│  │  │ Compliance     │  │  Notification  │  │                │  │                 │  │   │
│  │  │                │  │                │  │ - AI Cards     │  │ - Offline Cache │  │   │
│  │  │ - Excel Export │  │ - Form         │  │ - Priority     │  │ - Install Prompt│  │   │
│  │  │ - XLSX.js      │  │ - History      │  │ - KPIs         │  │ - PWA Features  │  │   │
│  │  └────────────────┘  └────────────────┘  └────────────────┘  └─────────────────┘  │   │
│  │                                                                                      │   │
│  └──────────────────────────────────────┬───────────────────────────────────────────────┘   │
│                                         │                                                    │
│  ┌──────────────────────────────────────▼───────────────────────────────────────────────┐   │
│  │                               SERVICES LAYER                                         │   │
│  │                                                                                      │   │
│  │  ┌─────────────────────┐  ┌──────────────────────┐  ┌──────────────────────────┐   │   │
│  │  │ apiService.ts       │  │ blockchainService.ts │  │ saMetros.ts              │   │   │
│  │  │                     │  │                      │  │                          │   │   │
│  │  │ - Axios HTTP client │  │ - SHA-256 Hashing    │  │ - Metro data constants  │   │   │
│  │  │ - API endpoints     │  │ - Block creation     │  │ - Data generation       │   │   │
│  │  │ - Error handling    │  │ - Chain verification │  │ - Water calculations    │   │   │
│  │  │ - System status     │  │ - Immutable chain    │  │ - 8 Metro definitions   │   │   │
│  │  └─────────────────────┘  └──────────────────────┘  └──────────────────────────┘   │   │
│  │                                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                              │
└───────────────────────────────┬──────────────────────────────────────────────────────────────┘
                                │ REST API (HTTP/JSON)
                                │ CORS Enabled
                                │
┌───────────────────────────────▼──────────────────────────────────────────────────────────────┐
│                              BACKEND APPLICATION                                             │
│                               Port: 8000 (FastAPI)                                           │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                             FastAPI Framework                                        │   │
│  │                                                                                      │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐ │   │
│  │  │ API Routes      │  │ Middleware      │  │ Dependencies    │  │ Models         │ │   │
│  │  │                 │  │                 │  │                 │  │                │ │   │
│  │  │ /api/v1/        │  │ - CORS Handler  │  │ - Auth (Future) │  │ - Pydantic     │ │   │
│  │  │ - /dashboard    │  │ - Logging       │  │ - DB Session    │  │ - Validation   │ │   │
│  │  │ - /metros       │  │ - Error Handler │  │ - Rate Limiting │  │ - Schemas      │ │   │
│  │  │ - /notifications│  │ - Request ID    │  │                 │  │                │ │   │
│  │  │ - /claude-ai    │  │                 │  │                 │  │                │ │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  └────────────────┘ │   │
│  │                                                                                      │   │
│  └──────────────────────────────────┬───────────────────────────────────────────────────┘   │
│                                     │                                                        │
│  ┌──────────────────────────────────▼───────────────────────────────────────────────────┐   │
│  │                            CORE BUSINESS LOGIC                                       │   │
│  │                                                                                      │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────┐ │   │
│  │  │ Water Service    │  │ Metro Service    │  │ Notification Svc │  │ Claude AI   │ │   │
│  │  │                  │  │                  │  │                  │  │ Service     │ │   │
│  │  │ - Intake calc    │  │ - CRUD ops       │  │ - Create notice  │  │             │ │   │
│  │  │ - Usage tracking │  │ - Multi-select   │  │ - Send alerts    │  │ - API calls │ │   │
│  │  │ - NRW analysis   │  │ - Data export    │  │ - Track history  │  │ - Prompts   │ │   │
│  │  │ - Stress levels  │  │ - Comparison     │  │ - Recipients     │  │ - Rec's     │ │   │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘  └─────────────┘ │   │
│  │                                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                              │
└──────────────────────────────┬───────────────────────────────────────────────────────────────┘
                               │
                ┌──────────────┴──────────────┬────────────────────────┐
                │                             │                        │
                │                             │                        │
┌───────────────▼──────────┐  ┌───────────────▼──────────┐  ┌─────────▼────────────┐
│     DATABASE LAYER       │  │   EXTERNAL SERVICES      │  │  BLOCKCHAIN LAYER    │
│  PostgreSQL + TimescaleDB│  │                          │  │                      │
│      Port: 5432          │  │  ┌───────────────────┐   │  │  ┌────────────────┐  │
├──────────────────────────┤  │  │ Claude AI API     │   │  │  │ SHA-256 Chain  │  │
│                          │  │  │                   │   │  │  │                │  │
│ ┌──────────────────────┐ │  │  │ - GPT-4 class    │   │  │  │ - Block Index  │  │
│ │  Tables              │ │  │  │ - Recommendations│   │  │  │ - Timestamp    │  │
│ │                      │ │  │  │ - Context aware  │   │  │  │ - Data Hash    │  │
│ │ metros               │ │  │  │ - JSON response  │   │  │  │ - Prev Hash    │  │
│ │ water_readings       │ │  │  └───────────────────┘   │  │  │ - Signature    │  │
│ │ notifications        │ │  │                          │  │  │                │  │
│ │ blockchain_records   │ │  │  ┌───────────────────┐   │  │  │ Immutable      │  │
│ │ claude_cache         │ │  │  │ Email/SMS Gateway │   │  │  │ Verifiable     │  │
│ │ audit_logs           │ │  │  │                   │   │  │  │ Audit Trail    │  │
│ │ users (future)       │ │  │  │ - SMTP            │   │  │  │                │  │
│ └──────────────────────┘ │  │  │ - Twilio (future) │   │  │  └────────────────┘  │
│                          │  │  │ - Push notif      │   │  │                      │
│ ┌──────────────────────┐ │  │  └───────────────────┘   │  └──────────────────────┘
│ │  TimescaleDB         │ │  │                          │
│ │  Hypertables         │ │  │  ┌───────────────────┐   │
│ │                      │ │  │  │ Dam Level API     │   │
│ │ water_time_series    │ │  │  │ (Future)          │   │
│ │ - Auto-partitioning  │ │  │  │                   │   │
│ │ - Continuous aggs    │ │  │  │ - DWS Integration │   │
│ │ - Compression        │ │  │  │ - Real-time data  │   │
│ │ - Retention policies │ │  │  │ - Alerts          │   │
│ └──────────────────────┘ │  │  └───────────────────┘   │
│                          │  │                          │
└──────────────────────────┘  └──────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════════

                              DATA FLOW DIAGRAM

USER ACTION                    FRONTEND                 BACKEND              DATABASE
─────────────                  ────────────            ────────────         ──────────

1. Select Metros
   └─> Click metros     ──────> handleMetroMultiSelect()
                                      │
                                      ├─> generateMetroWaterData()
                                      │
                                      ├─> blockchainVerifier.createBlock() ─> SHA-256 hash
                                      │                                       └─> Returns block
                                      ├─> Update state (allMetroData[])
                                      │
                                      └─> Re-render UI


2. Export to Excel
   └─> Click Export     ──────> handleExcelExport()
                                      │
                                      ├─> Map allMetroData to Excel format
                                      │
                                      ├─> XLSX.utils.json_to_sheet()
                                      │
                                      ├─> XLSX.writeFile()
                                      │
                                      └─> Download: SA_Metros_Water_Data_X_Metros.xlsx


3. Send Shutdown Notice
   └─> Fill form        ──────> handleSendNotification()
         + Submit                     │
                                      ├─> POST /api/v1/notifications  ────> Insert into DB
                                      │                                      │
                                      ├─> Trigger email/SMS gateway  <───────┘
                                      │
                                      ├─> Update notification history
                                      │
                                      └─> Show success message


4. Get AI Recommendations
   └─> Metro selected   ──────> Auto-triggered
                                      │
                                      ├─> GET /api/v1/claude-ai/recommendations
                                      │                 │
                                      │                 └──> POST to Claude API
                                      │                         │
                                      │                         ├─> Context: metro data
                                      │                         ├─> Prompt: conservation
                                      │                         └─> Return: JSON response
                                      │                                  │
                                      ├─> setClaudeRecommendations() <──┘
                                      │
                                      └─> Display recommendations UI


5. Real-time Blockchain Verification
   └─> Data change      ──────> Metro selection
                                      │
                                      ├─> Generate new water data
                                      │
                                      ├─> Create blockchain block
                                      │      │
                                      │      ├─> Calculate SHA-256(data)
                                      │      ├─> Link to previous block
                                      │      ├─> Add timestamp
                                      │      └─> Store in chain
                                      │
                                      ├─> Verify chain integrity
                                      │      │
                                      │      └─> Compare hashes
                                      │
                                      └─> Update metroData.blockchainHash


═══════════════════════════════════════════════════════════════════════════════════

                            DEPLOYMENT ARCHITECTURE

┌─────────────────────────────────────────────────────────────────────────────────┐
│                            DOCKER COMPOSE SETUP                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │ Frontend Container                                                        │ │
│  │ ────────────────────                                                      │ │
│  │ Image: node:18-alpine                                                     │ │
│  │ Port: 3000:3000                                                           │ │
│  │ Volume: ./frontend:/app                                                   │ │
│  │ Command: npm start                                                        │ │
│  │ Env: REACT_APP_API_URL=http://localhost:8000                             │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │ Backend Container                                                         │ │
│  │ ───────────────────                                                       │ │
│  │ Image: python:3.9-slim                                                    │ │
│  │ Port: 8000:8000                                                           │ │
│  │ Volume: ./backend:/app                                                    │ │
│  │ Command: uvicorn app.main:app --reload                                    │ │
│  │ Depends: postgres                                                         │ │
│  │ Env: DATABASE_URL=postgresql://user:pass@postgres:5432/ulwandle          │ │
│  │      CLAUDE_API_KEY=${CLAUDE_API_KEY}                                     │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │ Database Container                                                        │ │
│  │ ────────────────────                                                      │ │
│  │ Image: timescale/timescaledb:latest-pg14                                 │ │
│  │ Port: 5432:5432                                                           │ │
│  │ Volume: postgres_data:/var/lib/postgresql/data                           │ │
│  │ Env: POSTGRES_DB=ulwandle                                                 │ │
│  │      POSTGRES_USER=ulwandle_user                                          │ │
│  │      POSTGRES_PASSWORD=${DB_PASSWORD}                                     │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│  Networks:                                                                      │
│  ─────────                                                                      │
│  ulwandle_network (bridge)                                                     │
│                                                                                 │
│  Volumes:                                                                       │
│  ────────                                                                       │
│  postgres_data (persistent storage)                                            │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════════

                         SECURITY ARCHITECTURE

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              SECURITY LAYERS                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Layer 1: Transport Security                                                   │
│  ────────────────────────────                                                  │
│  ✓ HTTPS/TLS 1.3 (Production)                                                  │
│  ✓ Secure WebSocket connections                                                │
│  ✓ Certificate validation                                                      │
│                                                                                 │
│  Layer 2: API Security                                                         │
│  ───────────────────                                                           │
│  ✓ CORS configuration (whitelisted origins)                                    │
│  ✓ Rate limiting (Future: Redis-based)                                         │
│  ✓ API versioning (/api/v1/)                                                   │
│  ✓ Request validation (Pydantic)                                               │
│  ✓ JWT Authentication (Future)                                                 │
│                                                                                 │
│  Layer 3: Data Security                                                        │
│  ────────────────────                                                          │
│  ✓ SHA-256 blockchain hashing                                                  │
│  ✓ Data immutability verification                                              │
│  ✓ PostgreSQL encrypted connections                                            │
│  ✓ Environment variable secrets                                                │
│  ✓ No sensitive data in logs                                                   │
│                                                                                 │
│  Layer 4: Application Security                                                 │
│  ────────────────────────────                                                  │
│  ✓ Input sanitization                                                          │
│  ✓ XSS protection (React escaping)                                             │
│  ✓ SQL injection prevention (ORMs)                                             │
│  ✓ Error message sanitization                                                  │
│  ✓ Dependency vulnerability scanning                                           │
│                                                                                 │
│  Layer 5: Audit & Compliance                                                   │
│  ─────────────────────────────                                                 │
│  ✓ Blockchain audit trail                                                      │
│  ✓ Request logging                                                             │
│  ✓ User action tracking (Future)                                               │
│  ✓ World Bank PforR compliance                                                 │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════════

                         STATE MANAGEMENT FLOW

┌─────────────────────────────────────────────────────────────────────────────────┐
│                          REACT STATE HIERARCHY                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  App.tsx (Root State)                                                           │
│  ─────────────────────                                                          │
│                                                                                 │
│  ┌─ System State ──────────────────────────────────────────────────┐           │
│  │  - systemStatus: SystemStatus | null                            │           │
│  │  - isOnline: boolean                                             │           │
│  │  - installPrompt: BeforeInstallPromptEvent | null               │           │
│  └──────────────────────────────────────────────────────────────────┘           │
│                                                                                 │
│  ┌─ Metro State ───────────────────────────────────────────────────┐           │
│  │  - selectedMetros: Metro[]          (Multi-selection array)     │           │
│  │  - selectedMetro: Metro | null      (Primary display metro)     │           │
│  │  - currentMetroData: MetroWaterData | null  (Primary data)      │           │
│  │  - allMetroData: MetroWaterData[]   (All selected metros data)  │           │
│  └──────────────────────────────────────────────────────────────────┘           │
│                                                                                 │
│  ┌─ Analytics State ───────────────────────────────────────────────┐           │
│  │  - historicalData: HistoricalDataPoint[]  (7-day trends)        │           │
│  │  - claudeRecommendations: ClaudeRecommendationsData | null      │           │
│  │  - loadingRecommendations: boolean                              │           │
│  └──────────────────────────────────────────────────────────────────┘           │
│                                                                                 │
│  State Update Flow:                                                             │
│  ─────────────────                                                              │
│                                                                                 │
│  User selects metro ──> handleMetroMultiSelect(metros: Metro[])                │
│                              │                                                  │
│                              ├─> setSelectedMetros(metros)                      │
│                              │                                                  │
│                              ├─> Generate data for each metro                   │
│                              │   └─> blockchainVerifier.createBlock(data)       │
│                              │       └─> SHA-256 hash                           │
│                              │                                                  │
│                              ├─> setAllMetroData(allData)                       │
│                              │                                                  │
│                              ├─> setSelectedMetro(metros[0])                    │
│                              │                                                  │
│                              ├─> setCurrentMetroData(allData[0])                │
│                              │                                                  │
│                              ├─> Generate historical data                       │
│                              │   └─> setHistoricalData(historical)              │
│                              │                                                  │
│                              └─> Fetch Claude recommendations                   │
│                                  └─> setClaudeRecommendations(recs)             │
│                                                                                 │
│  Props Flow:                                                                    │
│  ───────────                                                                    │
│                                                                                 │
│  App                                                                            │
│   ├─> MetroSelector                                                             │
│   │    - selectedMetros={selectedMetros}                                        │
│   │    - onMultiSelect={handleMetroMultiSelect}                                 │
│   │                                                                              │
│   ├─> WorldBankCompliancePanel                                                  │
│   │    - allMetroData={allMetroData}                                            │
│   │                                                                              │
│   ├─> MetroDashboard                                                            │
│   │    - metroData={currentMetroData}                                           │
│   │    - historicalData={historicalData}                                        │
│   │                                                                              │
│   ├─> ShutdownNotification                                                      │
│   │    - metroData={currentMetroData}                                           │
│   │                                                                              │
│   └─> ClaudeRecommendationsPanel                                                │
│        - recommendations={claudeRecommendations}                                 │
│        - loading={loadingRecommendations}                                        │
│        - onRefresh={handleMetroSelect}                                           │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════════

                            TECHNOLOGY STACK

Frontend Technologies:
─────────────────────
├─ Core Framework
│  ├─ React 18.2.0
│  ├─ TypeScript 4.9.5
│  └─ React Scripts 5.0.1 (Create React App)
│
├─ Data Visualization
│  └─ Recharts 3.5.1
│
├─ Icons & UI
│  └─ Lucide React 0.555.0
│
├─ Data Processing
│  └─ XLSX 0.18.5 (SheetJS)
│
├─ HTTP Client
│  └─ Axios 1.6.2
│
├─ PWA Support
│  ├─ Service Workers
│  └─ Web App Manifest
│
└─ Styling
   └─ Custom CSS (Grid/Flexbox)

Backend Technologies:
────────────────────
├─ Web Framework
│  ├─ FastAPI 0.109+
│  └─ Uvicorn (ASGI server)
│
├─ Database
│  ├─ PostgreSQL 14
│  ├─ TimescaleDB (time-series)
│  └─ SQLAlchemy 2.0 (ORM)
│
├─ AI Integration
│  └─ Anthropic Claude API
│
├─ Data Validation
│  └─ Pydantic v2
│
└─ Security
   ├─ python-jose (JWT - Future)
   ├─ passlib (Password hashing - Future)
   └─ python-multipart

DevOps & Infrastructure:
────────────────────────
├─ Containerization
│  └─ Docker + Docker Compose
│
├─ Version Control
│  └─ Git + GitHub
│
├─ Environment Management
│  └─ python-dotenv
│
└─ Testing (Future)
   ├─ Jest (Frontend)
   └─ Pytest (Backend)

