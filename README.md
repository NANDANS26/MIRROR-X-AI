# MIRROR X AI

### AI-Powered Digital Manipulation Investigator

**Detect dark patterns. Simulate user impact. Generate forensic reports.**

Built for UX researchers, consumer advocates, and anyone who wants to know when a website is designed against them.

---

[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Gemini](https://img.shields.io/badge/Gemini-2.5%20Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql&logoColor=white)](https://postgresql.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## What Is This?

MIRROR X AI is a conversational forensic investigator for digital manipulation. You upload a screenshot or submit a URL, and the AI investigates the interface for manipulative design patterns — then narrates its findings like a professional analyst, not a dashboard.

The experience is designed to feel like talking to an intelligent investigator, not submitting a form.

---

## Features

### Core Investigation
- **Screenshot Analysis** — Upload any UI screenshot; OCR extracts all visible text and the AI inspects it
- **Live URL Analysis** — Submit a URL; Puppeteer captures a full-page screenshot + DOM for analysis
- **8 Dark Pattern Categories** — Fake Urgency, Confirm Shaming, Forced Continuity, Visual Coercion, Roach Motel, Sneak Into Basket, Misdirection, Hidden Costs

### AI Intelligence
- **Gemini 2.5 Flash** — Powers all analysis, chat, and report generation
- **Quota-Optimised** — Max 2 Gemini calls per investigation (1 for analysis + 1 per chat message)
- **Graceful Degradation** — Falls back to heuristic analysis when quota is exceeded; never returns 500

### Scoring & Risk Assessment
- **Manipulation Score** (0–100)
- **Trust Score** (0–100)
- **Friction Score** (0–100) — measures how hard it is to cancel/unsubscribe
- **UX Fairness Index** — Fair / Moderate Risk / High Risk

### Behavioral Simulation
- Simulates impact across 4 user personas: Elderly User, Distracted User, Impulsive User, First-Time User
- Per-persona severity escalation for sensitive pattern categories

### Reporting
- **PDF Forensic Report** — Executive summary, findings, risk scores, simulation results, annotated screenshot
- Generated on-demand, streamed as binary PDF to the browser

### Chat
- Conversational follow-up with full session context
- 10-message conversation memory window
- Grounded in actual analysis results

### Frontend
- Cinematic AI operating system interface (JARVIS-style)
- Real-time WebSocket pipeline progress
- 3D Neural Background (Three.js / React Three Fiber)
- Animated Investigation Orb (state-reactive)
- Action chips — no typing required for common actions
- Smart chat scrolling (preserves reading position)

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Frontend  (React 18 + Vite + Tailwind + Three.js)  │
│  Port: 5173                                          │
└──────────────────────┬──────────────────────────────┘
                       │ REST + WebSocket
┌──────────────────────▼──────────────────────────────┐
│  Backend   (Node.js + Express + Socket.io + Prisma) │
│  Port: 3001                                          │
└──────────────┬──────────────────┬───────────────────┘
               │ REST             │ Prisma ORM
┌──────────────▼──────────┐  ┌───▼──────────────────┐
│  AI Service (FastAPI)   │  │  PostgreSQL           │
│  Port: 8000             │  │  Port: 5432           │
└─────────────────────────┘  └───────────────────────┘
```

### Request Flow
1. User uploads screenshot or submits URL
2. Backend creates a pending session and returns `sessionId` immediately
3. Backend runs pipeline in background, emitting WebSocket events at each stage
4. AI Service performs: OCR → Rule Engine → Gemini Analysis → Simulation → Scoring
5. Results persisted to PostgreSQL; `session_complete` emitted
6. Frontend fetches full results and renders narrative findings

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, TypeScript, Vite 8, Tailwind CSS v4, Three.js, React Three Fiber, Framer Motion, GSAP, Lenis, Zustand, Socket.io-client |
| **Backend** | Node.js, Express.js, TypeScript, Prisma ORM, Socket.io, Puppeteer, JWT, bcrypt, Multer |
| **AI Service** | Python 3.11+, FastAPI, pytesseract, Pillow, Google Gemini 2.5 Flash, reportlab, Hypothesis (property-based testing) |
| **Database** | PostgreSQL 15 |
| **Testing** | Jest, ts-jest, fast-check (backend) • pytest + Hypothesis (AI service) |

---

## Project Structure

```
mirror-x-ai/
├── frontend/           # React + TypeScript SPA
│   └── src/
│       ├── pages/      # InvestigatorPage, LoginPage, RegisterPage
│       ├── components/ # Chat, Evidence, Analysis, Layout
│       ├── hooks/      # useInvestigation, useWebSocket, useChat
│       ├── store/      # Zustand stores (agent, chat, pipeline, session)
│       ├── services/   # API client, Socket.io, Investigation Narrator
│       ├── background/ # Three.js/R3F Neural Background
│       └── widgets/    # Investigation Orb
│
├── backend/            # Node.js + Express API
│   └── src/
│       ├── controllers/ # auth, analysis, chat, report
│       ├── services/    # pipelineOrchestrator, scraperService
│       ├── database/    # Prisma client, sessionRepository
│       ├── middleware/  # auth, upload, error
│       └── routes/      # auth, analysis, chat, report, health
│
├── ai/                 # Python FastAPI microservice
│   └── app/
│       ├── api/        # analyze, simulate, score, chat, report
│       ├── analyzers/  # ocr_engine, rule_engine, analyzer
│       ├── simulation/ # simulation_engine (4 personas)
│       ├── scoring/    # scoring_engine
│       ├── reports/    # report_generator (reportlab PDF)
│       ├── prompts/    # prompt_builder
│       ├── services/   # gemini_client
│       ├── schemas/    # Pydantic models
│       └── utils/      # output_filter (ethical AI guardrails)
│
└── .kiro/specs/        # Spec-driven development artifacts
```

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 18 | For backend and frontend |
| Python | 3.11+ | For AI service (venv recommended) |
| PostgreSQL | 15 | Local instance at port 5432 |
| Tesseract OCR | 5.x | Required for screenshot text extraction |
| Google Gemini API Key | — | Free tier: 20 requests/day |

### Install Tesseract (Windows)
Download from [UB Mannheim](https://github.com/UB-Mannheim/tesseract/wiki) and add to PATH.

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/your-username/mirror-x-ai.git
cd mirror-x-ai
```

### 2. Start PostgreSQL

```bash
# Docker (recommended)
docker run -d --name mirror-x-pg \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=mirror_x_ai \
  postgres:15
```

### 3. Set up the Backend

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT_SECRET

# Run database migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Start development server
npm run dev
```

**Backend .env:**
```env
PORT=3001
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mirror_x_ai"
JWT_SECRET=your-secret-key-here
AI_SERVICE_URL=http://localhost:8000
```

### 4. Set up the AI Service

```bash
cd ai

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Add your GEMINI_API_KEY

# Start the service
uvicorn app.main:app --reload --port 8000
```

**AI Service .env:**
```env
GEMINI_API_KEY=your-gemini-api-key-here
```

Get a free Gemini API key at [aistudio.google.com](https://aistudio.google.com).

### 5. Set up the Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173)

---

## Usage

### Investigate a Screenshot
1. Click the paperclip icon or drag a screenshot into the chat
2. The AI immediately begins forensic analysis
3. Watch real-time pipeline progress in the right panel
4. Read the investigation narrative in the chat
5. Use action chips to dig deeper or generate a report

### Investigate a URL
1. Paste any `https://` URL into the chat input
2. The URL badge appears; press Enter or click Send
3. MIRROR X AI captures the live page with Puppeteer
4. Full analysis proceeds the same as screenshot mode

### Generate a Report
- Click the **Generate PDF Report** action chip, or
- Type "generate report" in the chat

### Chat Follow-up
Ask questions about the findings in natural language:
- "Why is the manipulation score so high?"
- "Which pattern is most harmful to elderly users?"
- "What would a redesign of the checkout look like?"

---

## API Reference

### Backend API (port 3001)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | — | Register, returns JWT |
| POST | `/api/auth/login` | — | Login, returns JWT |
| POST | `/api/analysis/upload` | JWT | Upload screenshot, returns sessionId |
| POST | `/api/analysis/url` | JWT | Submit URL, returns sessionId |
| GET | `/api/analysis/:sessionId` | JWT | Fetch full session results |
| GET | `/api/analysis/history` | JWT | List past 100 sessions |
| DELETE | `/api/analysis/:sessionId` | JWT | Delete session |
| GET | `/api/report/:sessionId` | JWT | Stream PDF binary |
| POST | `/api/chat/:sessionId` | JWT | Chat with context |
| GET | `/api/health` | — | Health check |
| GET | `/api/health/db` | — | Database connectivity check |

### AI Service API (port 8000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/analyze/upload` | OCR + rule engine + Gemini analysis |
| POST | `/analyze/url` | Analyze scraped DOM data |
| POST | `/simulate` | Behavioral simulation (4 personas) |
| POST | `/score` | Compute risk scores |
| POST | `/chat/explain` | AI Investigator response |
| POST | `/report/generate` | Generate PDF report |
| GET | `/health` | Health check |

### WebSocket Events (Socket.io)

| Event | Direction | Payload |
|-------|-----------|---------|
| `session_started` | Server → Client | `{ sessionId }` |
| `stage_progress` | Server → Client | `{ stage, stepNumber, totalSteps, label }` |
| `session_complete` | Server → Client | `{ sessionId, ai_error? }` |
| `session_failed` | Server → Client | `{ sessionId, failedStage, message }` |

---

## Dark Patterns Detected

| Pattern | Description |
|---------|-------------|
| **Fake Urgency** | Countdown timers, scarcity language, "only X left" |
| **Confirm Shaming** | Opt-out labels using guilt or shame |
| **Forced Continuity** | Auto-renewing subscriptions buried in fine print |
| **Visual Coercion** | Pre-checked boxes, low-contrast decline buttons |
| **Roach Motel** | Easy to sign up, hard to cancel |
| **Sneak Into Basket** | Items auto-added without explicit consent |
| **Misdirection** | Deceptive button placement or confusing action labels |
| **Hidden Costs** | Fees revealed only at checkout |

---

## Running Tests

### Backend Tests (118 tests)
```bash
cd backend
npm test
```

### AI Service Tests (266 tests, includes Hypothesis property-based tests)
```bash
cd ai
venv\Scripts\activate
python -m pytest tests/ -v
```

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 3001) |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string |
| `JWT_SECRET` | **Yes** | Secret for JWT signing (min 32 chars) |
| `AI_SERVICE_URL` | No | AI service URL (default: http://localhost:8000) |

### AI Service (`ai/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | **Yes** | Google Gemini API key |

---

## Gemini Quota Management

The free tier allows 20 requests/day for Gemini 2.5 Flash. MIRROR X AI is optimised:

- **Analysis stage**: 1 call total (batch analysis of all patterns)
- **Simulation**: 0 calls (heuristic engine, no Gemini)
- **Scoring**: 0 calls (pure algorithm)
- **Report**: 0 additional calls
- **Chat**: 1 call per user message

**Maximum per investigation: 1–2 Gemini calls** (vs. the unoptimised 9+)

When quota is exhausted, the system falls back to heuristic analysis and displays a clear message instead of crashing.

---

## Security

- Passwords hashed with bcrypt (12 rounds)
- JWT authentication with 24-hour expiry
- Account lockout after 5 failed login attempts (15-minute cooldown)
- File uploads: MIME type filtering (JPEG/PNG/WebP only), 10 MB limit
- UUID-based filenames prevent path traversal
- All AI outputs filtered for absolute claims (no "is malicious", "is illegal")
- Legal disclaimer injected on every AI response

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Run tests for the service you're modifying
4. Push to your branch and open a pull request

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built with the belief that users deserve to understand the interfaces that influence their decisions.

</div>
