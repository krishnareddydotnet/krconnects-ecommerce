// -----------------------------------------------------------------------
// The background worker: receives OrderPlaced messages from the Service Bus
// subscription and hands each one to messageHandler.
//
// Login: Microsoft Entra ID via DefaultAzureCredential (Workload Identity in
// AKS). No connection strings or keys.
// -----------------------------------------------------------------------

const { ServiceBusClient } = require('@azure/service-bus');
const { DefaultAzureCredential } = require('@azure/identity');
const { handleMessage } = require('./messageHandler');

// After a receive error we report "not ready" for this long. The SDK keeps
// retrying by itself; if errors keep coming (e.g. missing role), we stay not ready.
const ERROR_WINDOW_MS = 60 * 1000;

// state: 'not-configured' | 'running' | 'stopped'
let state = 'not-configured';
let lastErrorAt = null;
let client = null;
let receiver = null;
let subscription = null;

function start(config) {
  client = new ServiceBusClient(config.serviceBusNamespace, new DefaultAzureCredential());

  // peekLock: messages are locked, not removed, until we settle them.
  // (receiveAndDelete would remove a message BEFORE we sent the confirmation,
  // so a crash would lose it.)
  receiver = client.createReceiver(config.topic, config.subscription, { receiveMode: 'peekLock' });

  subscription = receiver.subscribe(
    {
      // Called for every message
      processMessage: async (message) => {
        await handleMessage(message, receiver);
      },

      // Called for connection/receive problems. The SDK retries by itself;
      // we only log (no secrets in err.message) and remember the time for /health/ready.
      processError: async (args) => {
        console.error(`Service Bus error (${args.errorSource}): ${args.error.message}`);
        lastErrorAt = Date.now();
      }
    },
    {
      // We decide ourselves (complete / dead-letter / abandon) in messageHandler
      autoCompleteMessages: false,
      // Handle several messages at the same time (one slow e-mail doesn't block the rest)
      maxConcurrentCalls: config.maxConcurrentCalls
    }
  );

  state = 'running';
  console.log(
    `Receiving from topic "${config.topic}", subscription "${config.subscription}" ` +
    `(max ${config.maxConcurrentCalls} at a time)`
  );
}

// Used by GET /health/ready
function isReady() {
  if (state !== 'running') {
    return false;
  }
  const recentError = lastErrorAt !== null && Date.now() - lastErrorAt < ERROR_WINDOW_MS;
  return !recentError;
}

function getState() {
  return state;
}

// Graceful shutdown: stop taking new messages, then close the connection.
// Messages still locked but not completed are simply delivered again later.
async function stop() {
  if (subscription) {
    await subscription.close();
  }
  if (receiver) {
    await receiver.close();
  }
  if (client) {
    await client.close();
  }
  state = 'stopped';
}

module.exports = { start, stop, isReady, getState };
