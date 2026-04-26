# TARS Node.js SDK

The official Node.js SDK for the Threat Analysis & Response System (TARS). This SDK provides an Express.js middleware that automatically monitors and forwards incoming web traffic to your self-hosted TARS deployment for real-time anomaly detection and threat scoring.

## Installation

```bash
npm install tars-sdk-node
```

## Usage (Express.js)

```javascript
const express = require('express');
const { TarsMiddleware } = require('tars-sdk-node');

const app = express();

// Initialize the SDK with your self-hosted TARS URL
const tars = new TarsMiddleware({
  serverUrl: 'http://localhost:8000', // Your TARS Backend URL
  apiKey: 'optional-api-key',
  mode: 'monitoring', // Asynchronously analyzes traffic without blocking
  batchSize: 10,      // Flushes logs to TARS every 10 requests
  flushInterval: 5000 // Or every 5 seconds
});

// Attach it as a global middleware
app.use(tars.analyzeTraffic());

app.get('/', (req, res) => {
  res.send("Your site is now protected by TARS!");
});

app.listen(3001, () => console.log('Enterprise server running on port 3001'));
```

## How it Works
1. The SDK captures incoming HTTP request metadata (IP, headers, payload size).
2. It asynchronously batches and sends this data to the TARS `/api/v1/sdk/ingest` endpoint.
3. The TARS backend processes these logs through its ML isolation forests to detect anomalies.
4. You can view all threat logs via your TARS Mission Control Dashboard.
