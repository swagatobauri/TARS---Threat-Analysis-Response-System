#!/bin/bash

# TARS Stop Script

echo "🛑 Stopping TARS System..."

if [ -f .backend_pid ]; then
  kill $(cat .backend_pid) && rm .backend_pid
  echo "Stopped Backend API"
fi

if [ -f .worker_pid ]; then
  kill $(cat .worker_pid) && rm .worker_pid
  echo "Stopped Celery Worker"
fi

if [ -f .beat_pid ]; then
  kill $(cat .beat_pid) && rm .beat_pid
  echo "Stopped Celery Beat"
fi

if [ -f .frontend_pid ]; then
  kill $(cat .frontend_pid) && rm .frontend_pid
  echo "Stopped Frontend"
fi

# Clean up logs (optional)
# rm *.log

echo "✅ All systems offline."
