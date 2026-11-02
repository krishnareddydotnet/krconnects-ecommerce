// -----------------------------------------------------------------------
// What to do with ONE message from the Service Bus subscription.
// Kept separate from the Service Bus connection code (worker.js), so it is
// easy to unit test with fake messages and a fake receiver.
//
// We use "peekLock": a received message is only LOCKED, not removed.
// It is removed when we call completeMessage. So we decide for each message:
//   valid + sent        -> completeMessage    (done, remove it)
//   invalid             -> deadLetterMessage  (retrying will never fix it)
//   duplicate           -> completeMessage    (already sent, don't send twice)
//   temporary error     -> abandonMessage     (Service Bus delivers it again)
// -----------------------------------------------------------------------

const notifier = require('./notifier');

// ----- Idempotency: remember recently processed orders -----
// Service Bus delivers "at least once", so the same message can arrive twice
// (e.g. our complete call was lost). We remember the last 1000 order numbers
// and skip repeats, so the customer doesn't get two confirmations.
// In production this would be a database or cache (e.g. Redis): memory is
// lost on restart and not shared between pods.
const MAX_REMEMBERED = 1000;
const processedOrderNumbers = new Set();

function rememberOrder(orderNumber) {
  processedOrderNumbers.add(orderNumber);

  // A Set keeps insertion order, so the first value is the oldest one
  if (processedOrderNumbers.size > MAX_REMEMBERED) {
    const oldest = processedOrderNumbers.values().next().value;
    processedOrderNumbers.delete(oldest);
  }
}

// Only used by tests, so each test starts with an empty memory
function forgetProcessedOrders() {
  processedOrderNumbers.clear();
}

// The body is normally already an object (JSON message). If a sender put
// plain JSON text in it, read that text. Returns null if it can't be read.
function readBody(message) {
  if (typeof message.body === 'string') {
    try {
      return JSON.parse(message.body);
    } catch {
      return null;
    }
  }
  if (message.body !== null && typeof message.body === 'object') {
    return message.body;
  }
  return null;
}

// Returns an error text for an invalid event, or null when it is valid
function validateEvent(event) {
  if (!event) {
    return 'Body is not a JSON object.';
  }
  if (event.eventType !== 'OrderPlaced') {
    return 'eventType must be "OrderPlaced".';
  }
  if (typeof event.orderNumber !== 'string' || event.orderNumber.trim() === '') {
    return 'orderNumber is missing.';
  }
  return null;
}

// receiver = the Service Bus receiver (or a fake in tests). It settles the
// message: completeMessage / deadLetterMessage / abandonMessage.
async function handleMessage(message, receiver) {
  const event = readBody(message);
  const problem = validateEvent(event);

  // 1. Invalid -> dead-letter queue. Retrying would fail the same way every
  //    time; in the dead-letter queue a person can look at it later.
  //    (We log the messageId and the reason, never the full body.)
  if (problem) {
    console.warn(`Invalid message ${message.messageId}: ${problem} -> dead-letter`);
    await receiver.deadLetterMessage(message, {
      deadLetterReason: 'InvalidMessage',
      deadLetterErrorDescription: problem
    });
    return 'dead-lettered';
  }

  // 2. Already processed -> complete it again, but don't notify twice
  if (processedOrderNumbers.has(event.orderNumber)) {
    console.log(`Duplicate OrderPlaced ${event.orderNumber} skipped`);
    await receiver.completeMessage(message);
    return 'duplicate';
  }

  // 3. Send the confirmation
  try {
    await notifier.sendOrderConfirmation(event);
  } catch (err) {
    // Temporary problem (e.g. e-mail service down). Don't complete: abandon,
    // so Service Bus delivers it again. After the subscription's
    // "max delivery count" (5) it moves to the dead-letter queue by itself.
    console.error(`Confirmation for ${event.orderNumber} failed (attempt ${message.deliveryCount}): ${err.message}`);
    await abandonQuietly(message, receiver);
    return 'retry';
  }

  // 4. Remember it BEFORE completing: if complete fails, the redelivered copy
  //    is recognised as a duplicate.
  rememberOrder(event.orderNumber);
  await receiver.completeMessage(message);
  return 'completed';
}

// If abandon itself fails (e.g. connection lost) that's OK: the lock simply
// expires and Service Bus delivers the message again anyway.
async function abandonQuietly(message, receiver) {
  try {
    await receiver.abandonMessage(message);
  } catch (err) {
    console.error(`Abandon failed for message ${message.messageId}: ${err.message}`);
  }
}

module.exports = { handleMessage, validateEvent, forgetProcessedOrders, MAX_REMEMBERED };
