const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const notifier = require('../src/notifier');
const { handleMessage, forgetProcessedOrders, MAX_REMEMBERED } = require('../src/messageHandler');

// A message like order-api sends it
function makeMessage(bodyChanges = {}) {
  return {
    messageId: 'KRC-20261031-ABC123',
    deliveryCount: 1,
    body: {
      eventType: 'OrderPlaced',
      orderId: 42,
      orderNumber: 'KRC-20261031-ABC123',
      userId: 1,
      username: 'krishna',
      total: 2597,
      itemCount: 3,
      createdAt: '2026-10-31T10:00:00Z',
      ...bodyChanges
    }
  };
}

// A fake receiver that records how each message was settled
function makeReceiver() {
  return {
    completeMessage: mock.fn(async () => {}),
    deadLetterMessage: mock.fn(async () => {}),
    abandonMessage: mock.fn(async () => {})
  };
}

describe('messageHandler', () => {
  let receiver;

  beforeEach(() => {
    forgetProcessedOrders();
    receiver = makeReceiver();
    mock.method(notifier, 'sendOrderConfirmation', async () => {});
    mock.method(console, 'log', () => {});
    mock.method(console, 'warn', () => {});
    mock.method(console, 'error', () => {});
  });

  afterEach(() => mock.restoreAll());

  it('valid message -> notifies once and completes', async () => {
    const message = makeMessage();

    const result = await handleMessage(message, receiver);

    assert.equal(result, 'completed');
    assert.equal(notifier.sendOrderConfirmation.mock.callCount(), 1);
    assert.equal(notifier.sendOrderConfirmation.mock.calls[0].arguments[0].orderNumber, 'KRC-20261031-ABC123');
    assert.equal(receiver.completeMessage.mock.callCount(), 1);
    assert.equal(receiver.completeMessage.mock.calls[0].arguments[0], message);
    assert.equal(receiver.deadLetterMessage.mock.callCount(), 0);
  });

  it('body sent as JSON text is also understood', async () => {
    const message = makeMessage();
    message.body = JSON.stringify(message.body);

    const result = await handleMessage(message, receiver);

    assert.equal(result, 'completed');
  });

  const invalidBodies = [
    ['wrong eventType', makeMessage({ eventType: 'OrderCancelled' }).body],
    ['missing orderNumber', makeMessage({ orderNumber: undefined }).body],
    ['empty orderNumber', makeMessage({ orderNumber: '  ' }).body],
    ['not JSON', 'this is not json'],
    ['empty body', null]
  ];

  for (const [name, body] of invalidBodies) {
    it(`invalid message (${name}) -> dead-letter with reason InvalidMessage`, async () => {
      const message = { messageId: 'bad-1', deliveryCount: 1, body: body };

      const result = await handleMessage(message, receiver);

      assert.equal(result, 'dead-lettered');
      assert.equal(receiver.deadLetterMessage.mock.callCount(), 1);
      const options = receiver.deadLetterMessage.mock.calls[0].arguments[1];
      assert.equal(options.deadLetterReason, 'InvalidMessage');
      assert.ok(options.deadLetterErrorDescription);
      assert.equal(notifier.sendOrderConfirmation.mock.callCount(), 0);
      assert.equal(receiver.completeMessage.mock.callCount(), 0);
    });
  }

  it('duplicate message -> completes without notifying twice', async () => {
    await handleMessage(makeMessage(), receiver);

    const result = await handleMessage(makeMessage(), receiver);   // same orderNumber again

    assert.equal(result, 'duplicate');
    assert.equal(notifier.sendOrderConfirmation.mock.callCount(), 1);
    assert.equal(receiver.completeMessage.mock.callCount(), 2);
  });

  it('notifier error -> NOT completed, abandoned so Service Bus retries', async () => {
    notifier.sendOrderConfirmation.mock.mockImplementation(async () => {
      throw new Error('e-mail service down');
    });

    const result = await handleMessage(makeMessage(), receiver);

    assert.equal(result, 'retry');
    assert.equal(receiver.completeMessage.mock.callCount(), 0);
    assert.equal(receiver.deadLetterMessage.mock.callCount(), 0);
    assert.equal(receiver.abandonMessage.mock.callCount(), 1);
  });

  it('after a notifier error, the retried message is sent (not seen as a duplicate)', async () => {
    notifier.sendOrderConfirmation.mock.mockImplementationOnce(async () => {
      throw new Error('e-mail service down');
    });

    await handleMessage(makeMessage(), receiver);                       // fails
    const result = await handleMessage(makeMessage(), receiver);        // retry

    assert.equal(result, 'completed');
    assert.equal(notifier.sendOrderConfirmation.mock.callCount(), 2);
  });

  it('a failing abandon does not throw (the lock just expires)', async () => {
    notifier.sendOrderConfirmation.mock.mockImplementation(async () => {
      throw new Error('e-mail service down');
    });
    receiver.abandonMessage = mock.fn(async () => {
      throw new Error('connection lost');
    });

    const result = await handleMessage(makeMessage(), receiver);

    assert.equal(result, 'retry');
  });

  it(`remembers only the last ${MAX_REMEMBERED} orders`, async () => {
    // Order 0 is processed first, then 1000 newer orders push it out
    for (let i = 0; i <= MAX_REMEMBERED; i++) {
      await handleMessage(makeMessage({ orderNumber: `KRC-20261031-N${i}` }), receiver);
    }

    const oldest = await handleMessage(makeMessage({ orderNumber: 'KRC-20261031-N0' }), receiver);
    const newest = await handleMessage(makeMessage({ orderNumber: `KRC-20261031-N${MAX_REMEMBERED}` }), receiver);

    assert.equal(oldest, 'completed');     // forgotten -> processed again
    assert.equal(newest, 'duplicate');     // still remembered
  });
});
