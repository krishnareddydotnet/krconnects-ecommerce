// -----------------------------------------------------------------------
// KRConnects Notification Service - small Express app, ONLY for the
// Kubernetes health probes. The real work happens in worker.js.
// -----------------------------------------------------------------------

const express = require('express');
const worker = require('./worker');

const app = express();
app.disable('x-powered-by');

// Liveness: the process is up. No Service Bus check, so a Service Bus
// outage does NOT make Kubernetes restart the pod.
app.get('/health/live', (req, res) => {
  res.json({ status: 'ok', check: 'live' });
});

// Readiness: the receiver is running and had no recent errors
app.get('/health/ready', (req, res) => {
  if (!worker.isReady()) {
    return res.status(503).json({ status: 'unavailable', check: 'ready', receiver: worker.getState() });
  }
  res.json({ status: 'ok', check: 'ready', receiver: 'running' });
});

// GET / - shows which app this is (same idea as the other services)
app.get('/', (req, res) => {
  res.json({
    message: 'This is the KRConnects Notification Service — sends order confirmations.',
    service: 'krconnects-notification-service',
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({ message: 'Not found.' });
});

module.exports = app;
