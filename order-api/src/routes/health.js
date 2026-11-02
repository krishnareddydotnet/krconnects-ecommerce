// -----------------------------------------------------------------------
// Health endpoints for Kubernetes probes (same idea as the other services).
//   GET /health/live  -> is the process running? (no dependency checks)
//   GET /health/ready -> can we reach the Data API? (needed to place orders)
// -----------------------------------------------------------------------

const express = require('express');
const dataApiClient = require('../services/dataApiClient');

const router = express.Router();

// Liveness: kept fast and simple, so a Data API outage does NOT make
// Kubernetes restart this pod.
router.get('/live', (req, res) => {
  res.json({ status: 'ok', check: 'live' });
});

// Readiness: without the Data API we can't save orders, so tell Kubernetes
// to stop sending traffic here (503) until the Data API is back.
router.get('/ready', async (req, res) => {
  const reachable = await dataApiClient.isReachable();
  if (!reachable) {
    return res.status(503).json({ status: 'unavailable', check: 'ready', dataApi: 'unreachable' });
  }
  res.json({ status: 'ok', check: 'ready', dataApi: 'reachable' });
});

module.exports = router;
