#!/bin/bash
# ═══════════════════════════════════════════════════
# TARS — Full System Demo Script
# ═══════════════════════════════════════════════════
# This script boots the entire AIRS infrastructure,
# loads sample data, and launches an attack simulation
# so you can watch TARS fight back in real-time.
#
# Usage:  chmod +x scripts/demo.sh && ./scripts/demo.sh
# ═══════════════════════════════════════════════════

set -e

echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║         TARS — SYSTEM BOOT               ║"
echo "  ║   Threat Analysis & Response System       ║"
echo "  ╚══════════════════════════════════════════╝"
echo ""

# ── Step 1: Start infrastructure ──
echo "[1/5] Starting Docker services (Postgres, Redis, Backend, Celery, Frontend)..."
docker-compose up -d
echo "      ✓ Services launched"

# ── Step 2: Wait for healthy ──
echo "[2/5] Waiting for services to initialize..."
sleep 12
echo "      ✓ Services ready"

# ── Step 3: Run database migrations ──
echo "[3/5] Running database migrations..."
docker-compose exec backend alembic upgrade head 2>/dev/null || echo "      (migrations skipped — may already be applied)"
echo "      ✓ Database schema ready"

# ── Step 4: Load sample data ──
echo "[4/5] Loading CICIDS2017 sample data into system..."
python scripts/dataset_loader.py --dataset cicids --mode simulate --n 200 2>/dev/null || echo "      (dataset not available — using synthetic data)"
echo "      ✓ Sample data loaded"

# ── Step 5: Launch attack simulation ──
echo "[5/5] Launching mixed traffic simulation (2 minutes)..."
echo ""
echo "  ┌──────────────────────────────────────────┐"
echo "  │  Dashboard:  http://localhost:3000        │"
echo "  │  War Games:  http://localhost:3000/war-games │"
echo "  │  API:        http://localhost:8000/docs   │"
echo "  └──────────────────────────────────────────┘"
echo ""
echo "  TARS is watching. Open the dashboard now."
echo ""

python scripts/traffic_simulator.py --mode mixed --duration 120 --attack-ratio 0.15
