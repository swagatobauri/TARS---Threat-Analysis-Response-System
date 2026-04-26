# TARS Deployment Guide

This document provides step-by-step instructions for deploying the **Threat Analysis & Response System (TARS)** to a production environment.

## 🏗 System Architecture
TARS consists of five core components:
1. **Frontend**: Next.js (React/TypeScript)
2. **Backend**: FastAPI (Python 3.11)
3. **Database**: PostgreSQL (Primary Data Store)
4. **Cache/Broker**: Redis (Celery Broker & SSE Hub)
5. **Asynchronous Loop**: Celery Worker & Beat (Detection, Response, Metrics)

---

## 🛠 Option 1: Automated Deployment (Recommended)
The easiest way to deploy TARS is using **Docker Compose**. This ensures all dependencies (Postgres, Redis, Python environments) are perfectly isolated and configured.

### Prerequisites
- Install [Docker](https://docs.docker.com/get-docker/)
- Install [Docker Compose](https://docs.docker.com/compose/install/)

### Steps
1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd TARS
   ```

2. **Configure Environment**:
   Copy `.env.example` to `.env` and update the values:
   ```bash
   cp .env.example .env
   ```
   *Crucial: Set a strong `POSTGRES_PASSWORD` and `GROQ_API_KEY`.*

3. **Launch the stack**:
   ```bash
   docker-compose up -d --build
   ```

4. **Verify Health**:
   - Dashboard: `http://localhost:3000`
   - API Docs: `http://localhost:8000/docs`
   - Health Check: `http://localhost:8000/api/v1/health`

---

## 💻 Option 2: Manual (Native) Deployment
Use this if you are deploying to a VPS without Docker.

### 1. Database & Cache Setup
Install and start PostgreSQL and Redis:
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql redis-server

# MacOS (Homebrew)
brew install postgresql@15 redis
brew services start postgresql@15
brew services start redis
```

**Create the TARS Database:**
```bash
sudo -u postgres psql -c "CREATE DATABASE TARS;"
sudo -u postgres psql -c "CREATE USER tars_user WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE TARS TO tars_user;"
```

### 2. Backend Deployment
1. **Navigate to backend and create a venv**:
   ```bash
   cd backend
   python3.11 -m venv venv
   source venv/bin/activate
   ```

2. **Install dependencies**:
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

3. **Configure Environment**:
   Create `backend/.env` with your production DB and Redis URLs:
   ```env
   DATABASE_URL=postgresql+asyncpg://tars_user:your_password@localhost:5432/TARS
   SYNC_DATABASE_URL=postgresql+psycopg2://tars_user:your_password@localhost:5432/TARS
   REDIS_URL=redis://localhost:6379/0
   GROQ_API_KEY=your_key_here
   SHADOW_MODE=False
   ```

4. **Run Migrations**:
   ```bash
   alembic upgrade head
   ```

5. **Start with Gunicorn (Production)**:
   ```bash
   gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:8000
   ```

### 3. Worker Deployment (Celery)
In two separate terminal sessions or systemd units:

**Worker (Process Tasks):**
```bash
source venv/bin/activate
celery -A celery_worker.celery_app worker --loglevel=info
```

**Beat (Scheduled Tasks):**
```bash
source venv/bin/activate
celery -A celery_worker.celery_app beat --loglevel=info
```

### 4. Frontend Deployment
1. **Navigate to frontend**:
   ```bash
   cd frontend
   npm install
   ```

2. **Configure Environment**:
   Create `frontend/.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://your-server-ip:8000
   GROQ_API_KEY=your_key_here
   ```

3. **Build and Serve**:
   ```bash
   npm run build
   npm start
   ```

---

## 🛡 Production Hardening (Recommended)

1. **Reverse Proxy (Nginx)**:
   Use Nginx to handle SSL and proxy requests to the frontend (3000) and backend (8000).
2. **Process Manager (Systemd)**:
   Create systemd unit files for `tars-backend`, `tars-worker`, and `tars-beat` to ensure they restart on crash/reboot.
3. **Firewall**:
   Close all ports except `80`, `443`, and `22` (SSH).
4. **Secrets**:
   Never commit `.env` files to version control. Use a secret manager if possible.

---

## 🔍 Troubleshooting
- **Port 3000/8000 in use**: Run `lsof -i :3000` and `kill -9 <PID>`.
- **DB Connection Refused**: Check if Postgres is listening on `5432` and `pg_hba.conf` allows connections.
- **Worker not receiving tasks**: Ensure Redis is running and the `REDIS_URL` matches across backend and workers.
