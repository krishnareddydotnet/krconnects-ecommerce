// -----------------------------------------------------------------------
// KRConnects Order API - the Express app (exported so tests can use it).
//
// - Places orders for logged-in users and lists their orders.
// - Has NO database: orders are saved through the Data API.
// - Prices always come from the Data API, never from the browser.
// -----------------------------------------------------------------------

const express = require('express');
const healthRoutes = require('./routes/health');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');

const app = express();

// Don't tell the world which framework we use (small security hardening)
app.disable('x-powered-by');

// Simple request log: method, path and status. We log req.path (no query
// string) and never headers, so tokens and secrets never end up in logs.
app.use((req, res, next) => {
  const started = Date.now();
  // Remember the path NOW: Express shortens req.path inside routers
  // (e.g. "/orders/5" becomes "/5"), so reading it later is misleading.
  const path = req.path;
  res.on('finish', () => {
    // Skip health probes: Kubernetes calls them every few seconds (noise)
    if (path.startsWith('/health/')) return;
    const ms = Date.now() - started;
    console.log(`${req.method} ${path} ${res.statusCode} ${ms}ms`);
  });
  next();
});

// Read JSON bodies. An order is small, so 10kb is plenty (stops huge bodies).
app.use(express.json({ limit: '10kb' }));

// GET / - shows which app this is (same idea as the other services)
app.get('/', (req, res) => {
  res.json({
    message: 'This is the KRConnects Order API — responsible for placing and reading orders.',
    service: 'krconnects-order-api',
    timestamp: new Date().toISOString()
  });
});

app.use('/health', healthRoutes);
app.use('/orders', orderRoutes);
app.use('/admin', adminRoutes);

// Unknown URL -> 404 as JSON (not Express' default HTML page)
app.use((req, res) => {
  res.status(404).json({ message: 'Not found.' });
});

// Last safety net for errors. Express calls this when something throws.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Broken JSON or a body that is too large: the caller's mistake -> 400
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body must be valid JSON.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(400).json({ message: 'Request body is too large.' });
  }

  console.error(`Unexpected error: ${err.message}`);
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
});

module.exports = app;
