FROM python:3.11-slim

WORKDIR /app

# Install system dependencies required for compiling Python packages and PostgreSQL client
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements.txt and install dependencies
# We assume the build context is the `backend` folder
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire backend application code
COPY . .

# Set PYTHONPATH so Python can find modules locally
ENV PYTHONPATH=/app

# The default command will start the FastAPI application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
