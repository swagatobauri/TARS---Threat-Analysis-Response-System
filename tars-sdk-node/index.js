const axios = require('axios');

class TarsMiddleware {
  constructor(config) {
    this.serverUrl = config.serverUrl || 'http://localhost:8000';
    this.apiKey = config.apiKey || ''; // For future use when Auth is added
    this.batchSize = config.batchSize || 10;
    this.flushInterval = config.flushInterval || 5000; // 5 seconds
    this.mode = config.mode || 'monitoring'; // 'monitoring' or 'blocking'
    
    this.logQueue = [];
    
    // Set up regular flushing of logs
    setInterval(() => this.flushLogs(), this.flushInterval);
  }

  // This is the actual Express middleware
  analyzeTraffic() {
    return async (req, res, next) => {
      // 1. Capture request data
      const trafficLog = {
        source_ip: req.ip || req.connection.remoteAddress || '127.0.0.1',
        dest_ip: 'server',
        src_port: req.connection.remotePort || null,
        dest_port: req.socket.localPort || null,
        protocol: req.protocol.toUpperCase(),
        bytes_sent: parseInt(req.get('content-length') || 0, 10),
        packets: 1, // Approximation
        duration_seconds: 0.1, // Approximation for simple ingest
        request_rate: 1.0, 
        user_agent: req.get('user-agent') || 'Unknown',
        raw_payload: req.body || null,
      };

      // 2. Add to queue
      this.logQueue.push(trafficLog);

      // 3. Flush immediately if queue is full
      if (this.logQueue.length >= this.batchSize) {
        this.flushLogs();
      }

      // In monitoring mode, we never block the request. We just analyze asynchronously.
      next();
    };
  }

  async flushLogs() {
    if (this.logQueue.length === 0) return;

    // Extract the batch
    const batch = [...this.logQueue];
    this.logQueue = []; // Clear the original queue

    try {
      await axios.post(`${this.serverUrl}/api/v1/sdk/ingest`, {
        logs: batch
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      // console.log(`[TARS SDK] Successfully ingested ${batch.length} logs.`);
    } catch (error) {
      console.error(`[TARS SDK] Failed to ingest logs: ${error.message}`);
      // In a production SDK, we might put these back into the queue for retry
    }
  }
}

module.exports = {
  TarsMiddleware
};
