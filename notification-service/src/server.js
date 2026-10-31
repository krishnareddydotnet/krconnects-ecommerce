// -----------------------------------------------------------------------
// KRConnects Notification Service - starts everything:
//   1. the health server (port 8083, for Kubernetes probes)
//   2. the Service Bus worker (receives OrderPlaced messages)
// -----------------------------------------------------------------------

const config = require('./config');
const app = require('./app');
const worker = require('./worker');

const server = app.listen(config.port, () => {
  console.log(`krconnects-notification-service health server on port ${config.port}`);
});

// Without a namespace we can't receive anything. Keep running (so the pod
// and its logs stay visible) but /health/ready answers 503.
if (!config.serviceBusNamespace) {
  console.warn('WARNING: SERVICEBUS_NAMESPACE is not set. Not receiving messages; /health/ready returns 503.');
} else {
  worker.start(config);
}

// Kubernetes stops a pod with SIGTERM (and kills it 30 seconds later):
// stop receiving, close the connections, then exit.
const SHUTDOWN_TIMEOUT_MS = 10 * 1000;

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down');

  // Safety net: closing can hang for a long time when Service Bus is
  // unreachable. Exit anyway; no message is lost, because messages we did
  // not complete are delivered again when their lock expires.
  const forceExit = setTimeout(() => {
    console.warn('Shutdown took too long, exiting now');
    process.exit(0);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();   // this timer alone must not keep the process alive

  try {
    await worker.stop();
  } catch (err) {
    console.error(`Error while stopping the worker: ${err.message}`);
  }
  server.close(() => {
    process.exit(0);
  });
});
