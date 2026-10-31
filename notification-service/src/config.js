// -----------------------------------------------------------------------
// Settings, read ONCE from environment variables (no secrets here:
// login to Service Bus uses Workload Identity, not keys).
// -----------------------------------------------------------------------

// MAX_CONCURRENT_CALLS must be a whole number >= 1; anything else -> default 5
function readMaxConcurrentCalls() {
  const value = Number(process.env.MAX_CONCURRENT_CALLS);
  if (Number.isInteger(value) && value >= 1) {
    return value;
  }
  return 5;
}

const config = {
  port: Number(process.env.PORT) || 8083,

  // Fully qualified, e.g. "<name>.servicebus.windows.net". Empty = not configured.
  serviceBusNamespace: process.env.SERVICEBUS_NAMESPACE || '',
  topic: process.env.SERVICEBUS_TOPIC || 'orders',
  subscription: process.env.SERVICEBUS_SUBSCRIPTION || 'notification-service',

  // How many messages this pod handles at the same time
  maxConcurrentCalls: readMaxConcurrentCalls()
};

module.exports = config;
