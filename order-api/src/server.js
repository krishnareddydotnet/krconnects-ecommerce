// -----------------------------------------------------------------------
// KRConnects Order API - starts the web server.
// The Express app itself lives in app.js, so tests can use it without
// opening a real port.
// -----------------------------------------------------------------------

const app = require('./app');
const { closeEventPublisher } = require('./events/orderEvents');

const port = Number(process.env.PORT) || 8082;

// Warn (but keep running) when the JWT key is missing: every order request
// will get 401 until the key is configured. We never print the key itself.
if (!process.env.Jwt__Key) {
  console.warn('WARNING: Jwt__Key is not set. All order requests will be rejected with 401.');
}

const server = app.listen(port, () => {
  console.log(`krconnects-order-api listening on port ${port}`);
});

// Kubernetes stops a pod with SIGTERM (and kills it 30 seconds later).
// Stop taking new requests, close the Service Bus connection cleanly, then exit.
const SHUTDOWN_TIMEOUT_MS = 10 * 1000;

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down');

  // Safety net: closing can hang when Service Bus is unreachable. Exit anyway.
  const forceExit = setTimeout(() => {
    console.warn('Shutdown took too long, exiting now');
    process.exit(0);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();   // this timer alone must not keep the process alive

  server.close(async () => {
    await closeEventPublisher();
    process.exit(0);
  });
});
