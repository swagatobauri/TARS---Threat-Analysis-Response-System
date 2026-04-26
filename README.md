<p align="center">
  <h1 align="center">TARS</h1>
  <p align="center"><strong>Threat Analysis & Response System</strong></p>
  <p align="center">
    An autonomous AI agent that watches, learns, and eliminates network threats in real-time.
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/python-3.11+-cc0000?style=flat-square&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/next.js-14-000000?style=flat-square&logo=next.js" />
  <img src="https://img.shields.io/badge/fastapi-0.104-009688?style=flat-square&logo=fastapi" />
  <img src="https://img.shields.io/badge/license-MIT-333333?style=flat-square" />
</p>

---

## What is TARS?

TARS is a **fully autonomous AI-powered intrusion detection and response system** built on the **Observe → Analyze → Reason → Decide → Act → Learn** loop. It doesn't just detect threats — it reasons about them, takes action, and explains its decisions in plain English using LLM-powered analysis.

Unlike rule-based IDS/IPS systems, TARS uses an **ensemble of ML models** (Isolation Forest + One-Class SVM) combined with a **multi-factor reasoning engine** that evaluates context, history, and risk to make intelligent, autonomous decisions.

### Key Capabilities

| Capability | Description |
|---|---|
| **Anomaly Detection** | Ensemble ML models (Isolation Forest + One-Class SVM) trained on real cybersecurity datasets (CICIDS2017, UNSW-NB15) |
| **AI Reasoning Engine** | Multi-factor weighted scoring — not simple if/else rules. Considers time-of-day, IP reputation, attack history, and confidence |
| **Autonomous Response** | Automatically executes actions: `MONITOR` → `ALERT` → `RATE_LIMIT` → `BLOCK_IP` based on threat severity |
| **Stateful Memory** | Remembers IP behavior over 30 days (Redis) + long-term decision history (PostgreSQL) |
| **Adaptive Learning** | Exponential moving average threshold updates, analyst feedback loop, atomic model retraining |
| **LLM Explanations** | Groq-powered (LLaMA 3) natural language threat explanations with fallback generator |
| **Real-Time Dashboard** | Next.js Mission Control UI with live threat feeds, anomaly charts, and IP intelligence |
| **War Games Engine** | Interactive in-browser attack simulation — no backend required |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    TARS Architecture                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────┐   │
│  │ Network  │───▶│ FastAPI  │───▶│ Celery Workers   │   │
│  │ Traffic  │    │ Ingest   │    │ (Detection Task) │   │
│  └──────────┘    └──────────┘    └────────┬─────────┘   │
│                                           │             │
│                                   ┌───────▼────────┐    │
│                                   │ ML Ensemble    │    │
│                                   │ IsoForest+SVM  │    │
│                                   └───────┬────────┘    │
│                                           │             │
│                                   ┌───────▼────────┐    │
│                                   │ Reasoning      │    │
│                                   │ Engine         │    │
│                                   └───────┬────────┘    │
│                                           │             │
│                          ┌────────────────┼────────┐    │
│                          │                │        │    │
│                  ┌───────▼───┐   ┌───────▼──┐ ┌───▼──┐ │
│                  │ Action    │   │ Memory   │ │ Groq │ │
│                  │ Executor  │   │ Store    │ │ LLM  │ │
│                  └───────────┘   └──────────┘ └──────┘ │
│                          │                              │
│                  ┌───────▼────────┐                     │
│                  │ Event Bus      │                     │
│                  │ (Redis PubSub) │                     │
│                  └───────┬────────┘                     │
│                          │                              │
│                  ┌───────▼────────┐                     │
│                  │ SSE Bridge     │──▶ Next.js Frontend │
│                  └────────────────┘                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14, Tailwind CSS, Recharts, Framer Motion, SWR |
| **Backend** | Python 3.11+, FastAPI, SQLAlchemy (async), Alembic |
| **ML** | scikit-learn (Isolation Forest, One-Class SVM), NumPy, Pandas |
| **Task Queue** | Celery + Redis (Beat scheduler for periodic tasks) |
| **Database** | PostgreSQL (persistent), Redis (cache + pub/sub + IP memory) |
| **LLM** | Groq API (LLaMA 3 8B) for threat explanations |
| **Infra** | Docker Compose, multi-container orchestration |

---

## Project Structure

```
TARS/
├── backend/
│   ├── main.py                     # FastAPI application entry point
│   ├── celery_worker.py            # Celery worker configuration
│   ├── app/
│   │   ├── api/
│   │   │   ├── logs.py             # Log ingestion + SSE live stream
│   │   │   ├── schemas.py          # Pydantic request/response models
│   │   │   └── websocket.py        # Redis → SSE event bridge
│   │   ├── agent/
│   │   │   ├── reasoning.py        # Multi-factor AI reasoning engine
│   │   │   ├── explainer.py        # Groq LLM threat explainer
│   │   │   └── fallback_explainer.py
│   │   ├── ml/
│   │   │   ├── models.py           # IsolationForest + SVM + Ensemble
│   │   │   ├── data_pipeline.py    # Feature extraction + scaling
│   │   │   └── adaptive.py         # Threshold manager + model updater
│   │   ├── memory/
│   │   │   └── memory_store.py     # Redis IP memory + PostgreSQL decisions
│   │   ├── core/
│   │   │   ├── config.py           # Environment configuration
│   │   │   └── event_bus.py        # Redis pub/sub event broadcasting
│   │   ├── db/
│   │   │   ├── database.py         # Async SQLAlchemy session
│   │   │   └── models.py           # ORM models
│   │   └── tasks/
│   │       └── detection.py        # Celery anomaly detection task
│   └── alembic/                    # Database migrations
├── frontend/
│   ├── app/
│   │   ├── page.tsx                # Landing page (brutalist theme)
│   │   ├── layout.tsx              # Root layout
│   │   ├── war-games/
│   │   │   └── page.tsx            # Interactive attack simulator
│   │   └── dashboard/
│   │       ├── layout.tsx          # Dashboard layout with sidebar
│   │       ├── page.tsx            # Main dashboard
│   │       ├── threats/            # Live threat feed
│   │       ├── ip-intelligence/    # IP profiling + reputation gauge
│   │       ├── action-logs/        # Execution history + CSV export
│   │       ├── replay/             # Attack replay system
│   │       └── health/             # System health monitoring
│   ├── components/
│   │   ├── layout/Sidebar.tsx
│   │   ├── charts/AnomalyChart.tsx
│   │   └── threats/LiveThreatFeed.tsx
│   └── lib/
│       ├── api.ts                  # Typed API client
│       └── hooks.ts                # SWR data fetching hooks
├── scripts/
│   ├── traffic_simulator.py        # Synthetic attack traffic generator
│   ├── dataset_loader.py           # CICIDS2017 + UNSW-NB15 loader
│   └── demo.sh                     # One-command full system demo
├── data/
│   └── README.md                   # Dataset download instructions
├── docker-compose.yml
└── .env.example
```

---

## Quick Start

### Prerequisites

- **Docker** & **Docker Compose** (recommended)
- **Node.js 18+** (for frontend dev)
- **Python 3.11+** (for scripts)

### Option 1: Docker (Full Stack)

```bash
# Clone the repository
git clone https://github.com/swagatobauri/TARS---Threat-Analysis-Response-System.git
cd TARS---Threat-Analysis-Response-System/TARS

# Copy environment variables
cp .env.example .env
# Edit .env and add your GROQ_API_KEY (get one free at https://console.groq.com)

# Launch everything
docker-compose up -d

# Run database migrations
docker-compose exec backend alembic upgrade head

# Open the dashboard
open http://localhost:3000
```

### Option 2: Local Development

**Terminal 1 — Backend:**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Start PostgreSQL and Redis (or use Docker for just these)
docker-compose up -d postgres redis

# Run migrations
alembic upgrade head

# Start FastAPI
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Celery Worker:**
```bash
cd backend
source venv/bin/activate
celery -A celery_worker worker --loglevel=info
```

**Terminal 3 — Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## Usage Guide

### 1. Landing Page

Navigate to `http://localhost:3000`. You'll see the brutalist TARS landing page with a boot sequence animation. From here you can enter **Mission Control** (the monitoring dashboard) or launch **War Games** (the attack simulator).

### 2. Mission Control Dashboard

The dashboard at `/dashboard` provides real-time visibility into the system:

| Page | What it shows |
|---|---|
| **Dashboard** | 4 key metrics + live threat feed + anomaly score chart |
| **Threat Feed** | Real-time SSE event stream from the backend |
| **IP Intelligence** | Search any IP → reputation gauge, 30-day timeline, attack patterns |
| **Action Logs** | Full execution history table with CSV export |
| **Attack Replay** | Re-run past attack scenarios against current models |
| **System Health** | Database, Celery, ML model, and Groq API status |

### 3. War Games (Interactive Attack Simulator)

Navigate to `/war-games`. This is the **flagship demo feature**:

1. **Enter a target** — type any URL or IP address (e.g., `myapp.com`)
2. **Select a mode:**
   - `Normal` — generates only baseline traffic
   - `Mixed` — 70% normal + 30% random attacks
   - `Attack Only` — pure malicious traffic
3. **Select an attack vector:**
   - `Brute Force` — SSH credential stuffing (port 22, tiny payloads)
   - `DDoS Flood` — multi-source HTTP flood (port 80, high volume)
   - `Port Scan` — sequential port enumeration (ports 1-1024)
4. **Click "ENGAGE TARGET"** — watch the system detect and respond in real-time
5. The **Live Detection Feed** shows every event with anomaly scores, risk levels, and autonomous actions taken

> **Note:** War Games runs entirely in the browser — no backend required. It uses a lightweight anomaly scoring engine to demonstrate TARS' detection logic.

### 4. Training on Real Datasets

```bash
# Train ML models on CICIDS2017 (balanced 50k sample)
python scripts/dataset_loader.py --dataset cicids --mode train --sample 50000

# Train on UNSW-NB15
python scripts/dataset_loader.py --dataset unsw --mode train --sample 50000

# Feed real attack data into the live system
python scripts/dataset_loader.py --dataset cicids --mode simulate --n 500
```

See `data/README.md` for dataset download instructions.

### 5. Traffic Simulation (CLI)

```bash
# Normal baseline traffic for 5 minutes
python scripts/traffic_simulator.py --mode normal --duration 300

# Mixed traffic with 15% attack probability
python scripts/traffic_simulator.py --mode mixed --duration 600 --attack-ratio 0.15

# Pure brute force attack for 60 seconds
python scripts/traffic_simulator.py --mode attack-only --attack-type brute_force --duration 60
```

### 6. One-Command Demo

```bash
chmod +x scripts/demo.sh
./scripts/demo.sh
```

This boots all Docker services, runs migrations, loads sample data, and launches a 2-minute mixed attack simulation. Open the dashboard and watch TARS fight back.

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://...` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379/0` |
| `GROQ_API_KEY` | Groq API key for LLM explanations | — |
| `NEXT_PUBLIC_API_URL` | Frontend API base URL | `/api/v1` |

---

## The OARDAL Loop

TARS operates on a continuous autonomous loop:

1. **Observe** — Ingest raw network logs via the FastAPI endpoint
2. **Analyze** — Extract features, run through the ML ensemble (Isolation Forest + SVM)
3. **Reason** — Multi-factor scoring: anomaly score × IP history × time-of-day × confidence
4. **Decide** — Select optimal action from the action space (MONITOR → BLOCK)
5. **Act** — Execute the decision (rate limit, block IP, etc.)
6. **Learn** — Update thresholds via EMA, collect analyst feedback, retrain models when 500+ labeled samples accumulate

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/logs` | Fetch recent network logs with anomaly scores |
| `POST` | `/api/v1/logs/ingest` | Ingest batch of network logs |
| `GET` | `/api/v1/logs/live` | SSE stream of real-time events |
| `GET` | `/api/v1/events/stream` | Redis pub/sub → SSE bridge |
| `GET` | `/api/v1/threats/stats` | Dashboard statistics |
| `GET` | `/api/v1/agent/decisions` | Agent decision history |
| `POST` | `/api/v1/agent/replay` | Replay attack scenario |
| `GET` | `/api/v1/health` | System health check |

---

## License

MIT

---

<p align="center">
  <strong>TARS doesn't sleep. It doesn't forget. It doesn't forgive.</strong>
</p>
