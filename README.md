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

TARS is a **fully autonomous AI-powered intrusion detection and response system** built on the **O.A.R.D.A.L.V.** loop (Observe → Analyze → Reason → Decide → Act → Learn → Validate). It doesn't just detect threats — it reasons about them, takes defensive action, and explains its logic in plain English.

Unlike traditional rule-based systems, TARS uses an **Ensemble ML core** combined with an **AI Reasoning Engine** that evaluates context, IP intelligence, and kill-chain positioning to make high-confidence autonomous decisions.

### 🛡 Core Capabilities

| Capability | Description |
|---|---|
| **Ensemble Detection** | Isolation Forest + One-Class SVM trained on CICIDS2017 & UNSW-NB15 |
| **Kill Chain Tracking** | Real-time mapping of attackers to stages: `RECON` → `EXPLOIT` → `PERSISTENCE` |
| **Mission Control** | A state-of-the-art command center with live feeds, metrics, and security controls |
| **Safety Layers** | **Shadow Mode** for baseline testing and **Human-in-the-loop** approval queues |
| **Adaptive Learning** | Automatic threshold adjustments via EMA and atomic model retraining (500+ feedback samples) |
| **Validation Step** | The 7th step: TARS validates if its action actually stopped the attack before closing the ticket |
| **LLM Reasoning** | Groq-powered (LLaMA 3) natural language threat analysis and reasoning reports |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    TARS — Mission Control                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────────┐   │
│  │ Ingest   │───▶│ FastAPI  │───▶│ Celery Loop          │   │
│  │ (Logs)   │    │ Gateway  │    │ (Analyze → Act)      │   │
│  └──────────┘    └──────────┘    └──────────┬───────────┘   │
│                                             │               │
│                                    ┌────────▼────────┐      │
│                                    │ ML Ensemble     │      │
│                                    │ Reasoning Engine│      │
│                                    └────────┬────────┘      │
│                                             │               │
│                        ┌────────────────────┼───────────────┤
│                        │                    │               │
│                ┌───────▼───────┐    ┌───────▼──────┐  ┌─────▼─────┐
│                │ Action Gate   │    │ Kill Chain   │  │ Groq LLM  │
│                │ (Block/Limit) │    │ Intelligence │  │ (Explain) │
│                └───────┬───────┘    └──────────────┘  └───────────┘
│                        │                                    │
│                ┌───────▼────────┐                           │
│                │ Event Bus      │◀──────────────────────────┘
│                │ (Redis PubSub) │──▶ Next.js Mission Control
│                └────────────────┘
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📂 Project Structure

```
TARS/
├── backend/
│   ├── main.py                     # FastAPI Entry Point
│   ├── app/
│   │   ├── api/
│   │   │   ├── kill_chain.py       # Attacker profiling API
│   │   │   ├── safety.py           # Approval & Mode controls
│   │   │   └── metrics.py          # Impact & Efficacy analytics
│   │   ├── kill_chain/
│   │   │   └── tracker.py          # Attacker state management
│   │   ├── safety/
│   │   │   ├── execution_gate.py   # Shadow Mode & Confidence logic
│   │   │   └── approval_handler.py # Human-in-the-loop queue
│   │   ├── metrics/
│   │   │   └── validator.py        # Post-action efficacy analysis
│   │   └── ml/
│   │       └── adaptive.py         # EMA Thresholding & Retraining
├── frontend/
│   ├── app/
│   │   ├── mission-control/        # The Command Center
│   │   │   ├── kill-chain/         # Active attacker tracking
│   │   │   ├── approvals/          # Human-in-the-loop queue
│   │   │   ├── metrics/            # Real-world impact & ROI
│   │   │   └── safety/             # Shadow Mode & Threshold sliders
│   │   └── war-games/              # LETHAL simulation console
│   └── components/
│       ├── layout/Sidebar.tsx      # High-performance navigation
├── scripts/
│   ├── war_games_report.py         # 60-minute stress test report
│   └── dataset_loader.py           # ML training tools
└── DEPLOYMENT.md                   # Production setup guide
```

---

## 🚀 Quick Start (Docker)

```bash
# 1. Clone & Setup
git clone https://github.com/swagatobauri/TARS---Threat-Analysis-Response-System.git
cd TARS---Threat-Analysis-Response-System/TARS
cp .env.example .env

# 2. Add your GROQ_API_KEY to .env

# 3. Spin up the stack
docker-compose up -d --build

# 4. Initialize Database
docker-compose exec backend alembic upgrade head

# 5. Access Mission Control
open http://localhost:3000/mission-control
```

---

## 🎮 The War Games Console

Navigate to `/war-games`. This is the flagship demonstration tool that allows you to:
1. **Engage Targets**: Simulate high-frequency attacks against a target URL.
2. **Select Vectors**: Choose between `Brute Force`, `DDoS`, `Port Scan`, or `Zero-Day`.
3. **Watch the Loop**: See the sidebar update in real-time as TARS detects the anomaly, calculates risk, and executes a defensive block.

---

## 🛡 Mission Control Pages

| View | Purpose |
|---|---|
| **Overview** | Real-time threat feed and system throughput. |
| **Kill Chain** | Identifies the exact stage of every active attacker. |
| **Approvals** | Human-in-the-loop queue for medium-confidence actions. |
| **Metrics** | Proof of efficacy: Attack reduction delta & ROI. |
| **Safety** | Toggle Shadow Mode or adjust Auto-Execute thresholds. |

---

## 🧪 Training & Simulation

```bash
# Train on CICIDS2017
python scripts/dataset_loader.py --dataset cicids --mode train --sample 50000

# Run a 60-minute War Game stress test
python scripts/war_games_report.py --duration 3600
```

---

## ⚖️ License

MIT. 

---

<p align="center">
  <strong>TARS doesn't sleep. It doesn't forget. It doesn't forgive.</strong>
</p>
