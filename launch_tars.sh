#!/bin/bash

# TARS Native Launch Script
# This script starts all 4 required services without Docker.

PROJECT_ROOT="/Users/swagatob/Documents/TARS - Threat Analysis & Response System/TARS"

echo "🚀 Starting TARS System..."

# 1. Start Backend API (Port 8000)
echo "📡 Starting Backend API..."
cd "$PROJECT_ROOT/backend"
source venv/bin/activate
nohup uvicorn main:app --host 0.0.0.0 --port 8000 > ../backend_api.log 2>&1 &
echo $! > ../.backend_pid

# 2. Start Celery Worker
echo "⚙️ Starting Celery Worker..."
nohup celery -A celery_worker.celery_app worker --loglevel=info > ../celery_worker.log 2>&1 &
echo $! > ../.worker_pid

# 3. Start Celery Beat (Scheduler)
echo "⏰ Starting Celery Beat..."
nohup celery -A celery_worker.celery_app beat --loglevel=info > ../celery_beat.log 2>&1 &
echo $! > ../.beat_pid

# 4. Start Frontend (Port 3000)
echo "🎨 Starting Frontend..."
cd "$PROJECT_ROOT/frontend"
# Build the production version
npm run build
nohup npm start > ../frontend.log 2>&1 &
echo $! > ../.frontend_pid

echo "✅ All systems launched!"
echo "------------------------------------------------"
echo "🖥 Dashboard: http://localhost:3000/mission-control"
echo "📖 API Docs:  http://localhost:8000/docs"
echo "------------------------------------------------"
echo "To stop everything, run: ./stop_tars.sh"
