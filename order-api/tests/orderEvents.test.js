const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { ServiceBusClient } = require('@azure/service-bus');
const { publishOrderPlaced, buildOrderPlacedMessage, closeEventPublisher } = require('../src/events/orderEvents');

// A saved order, like the Data API returns it
const order = {
  id: 42,
  orderNumber: 'KRC-20261031-ABC123',
  userId: 1,
  username: 'krishna',
  status: 'Placed',
  subtotal: 2597,
  delivery: 0,
  total: 2597,
  createdAt: '2026-10-31T10:00:00Z',
  items: [
    { productId: 1, productName: 'Wireless Mouse', unitPrice: 1599, quantity: 1, lineTotal: 1599 },
    { productId: 4, productName: 'Clean Code', unitPrice: 499, quantity: 2, lineTotal: 998 }
  ]
};

describe('OrderPlaced message', () => {
  it('has the agreed fields, and no item prices', () => {
    const message = buildOrderPlacedMessage(order);

    assert.deepEqual(message.body, {
      eventType: 'OrderPlaced',
      orderId: 42,
      orderNumber: 'KRC-20261031-ABC123',
      userId: 1,
      username: 'krishna',
      total: 2597,
      itemCount: 3,                       // 1 + 2 pieces
      createdAt: '2026-10-31T10:00:00Z'
    });
    assert.equal(message.messageId, 'KRC-20261031-ABC123');   // for duplicate detection
    assert.equal(message.subject, 'OrderPlaced');
    assert.equal(message.contentType, 'application/json');
  });
});

describe('publishOrderPlaced', () => {
  let fakeSender;

  beforeEach(() => {
    // Fake sender: no real Service Bus in unit tests
    fakeSender = {
      sendMessages: mock.fn(async () => {}),
      close: mock.fn(async () => {})
    };
    mock.method(ServiceBusClient.prototype, 'createSender', () => fakeSender);
    mock.method(ServiceBusClient.prototype, 'close', async () => {});
    mock.method(console, 'log', () => {});
    mock.method(console, 'error', () => {});
  });

  afterEach(async () => {
    await closeEventPublisher();          // forget the cached client between tests
    delete process.env.SERVICEBUS_NAMESPACE;
    mock.restoreAll();
  });

  it('only logs when SERVICEBUS_NAMESPACE is not set', async () => {
    await publishOrderPlaced(order);

    assert.equal(fakeSender.sendMessages.mock.callCount(), 0);
    assert.equal(console.log.mock.calls[0].arguments[0], 'OrderPlaced KRC-20261031-ABC123');
  });

  it('sends the message to Service Bus when SERVICEBUS_NAMESPACE is set', async () => {
    process.env.SERVICEBUS_NAMESPACE = 'test-namespace.servicebus.windows.net';

    await publishOrderPlaced(order);

    assert.equal(fakeSender.sendMessages.mock.callCount(), 1);
    const sent = fakeSender.sendMessages.mock.calls[0].arguments[0];
    assert.equal(sent.messageId, 'KRC-20261031-ABC123');
    assert.equal(sent.body.eventType, 'OrderPlaced');
  });

  it('reuses one sender for many orders', async () => {
    process.env.SERVICEBUS_NAMESPACE = 'test-namespace.servicebus.windows.net';

    await publishOrderPlaced(order);
    await publishOrderPlaced({ ...order, orderNumber: 'KRC-20261031-XYZ789' });

    assert.equal(ServiceBusClient.prototype.createSender.mock.callCount(), 1);
    assert.equal(fakeSender.sendMessages.mock.callCount(), 2);
  });

  it('never throws when sending fails, and logs the reason', async () => {
    process.env.SERVICEBUS_NAMESPACE = 'test-namespace.servicebus.windows.net';
    fakeSender.sendMessages = mock.fn(async () => {
      throw new Error('Service Bus is down');
    });

    await publishOrderPlaced(order);   // must not throw

    assert.equal(
      console.error.mock.calls[0].arguments[0],
      'OrderPlaced event not sent for KRC-20261031-ABC123: Service Bus is down'
    );
  });

  it('closeEventPublisher closes the sender', async () => {
    process.env.SERVICEBUS_NAMESPACE = 'test-namespace.servicebus.windows.net';
    await publishOrderPlaced(order);

    await closeEventPublisher();

    assert.equal(fakeSender.close.mock.callCount(), 1);
  });
});
