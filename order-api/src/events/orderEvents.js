// -----------------------------------------------------------------------
// Order events: tell the rest of the system that something happened.
//
// After an order is saved we send an "OrderPlaced" message to the Azure
// Service Bus TOPIC "orders". A topic (not a queue) lets more services
// subscribe later (e.g. analytics) without changing order-api.
// Today notification-service reads it and sends the order confirmation.
//
// Login to Service Bus: Microsoft Entra ID via DefaultAzureCredential.
// In AKS this uses Workload Identity, so there are NO connection strings
// or access keys anywhere.
//
// If SERVICEBUS_NAMESPACE is not set (local runs, tests) we only log.
// -----------------------------------------------------------------------

const { ServiceBusClient } = require('@azure/service-bus');
const { DefaultAzureCredential } = require('@azure/identity');

// Created once and reused: opening a connection for every order would be slow.
let client = null;
let sender = null;

function getSender() {
  if (sender) {
    return sender;
  }

  const namespace = process.env.SERVICEBUS_NAMESPACE;          // e.g. <name>.servicebus.windows.net
  const topic = process.env.SERVICEBUS_TOPIC || 'orders';

  client = new ServiceBusClient(namespace, new DefaultAzureCredential());
  sender = client.createSender(topic);
  return sender;
}

// The message other services receive. Only what they need: no address,
// no e-mail, no prices per item (keep personal and business data small).
function buildOrderPlacedMessage(order) {
  // itemCount = number of pieces (2 mice + 1 book = 3), like the cart badge
  let itemCount = 0;
  for (const item of order.items || []) {
    itemCount += item.quantity;
  }

  return {
    body: {
      eventType: 'OrderPlaced',
      orderId: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      username: order.username,
      total: order.total,
      itemCount: itemCount,
      createdAt: order.createdAt
    },
    // messageId = orderNumber: if the same order is sent twice, Service Bus
    // "duplicate detection" on the topic drops the second copy.
    messageId: order.orderNumber,
    subject: 'OrderPlaced',
    contentType: 'application/json'
  };
}

// Never throws: the order is ALREADY saved, so a Service Bus problem must
// not turn a successful order into an error for the customer.
//
// NOTE: if the send fails, the event is lost (the customer just gets no
// confirmation). Production systems use the "transactional outbox" pattern:
// save the event in the database in the same transaction as the order, and
// a background job sends it until it succeeds. We accept this simpler
// approach for now.
async function publishOrderPlaced(order) {
  if (!process.env.SERVICEBUS_NAMESPACE) {
    console.log(`OrderPlaced ${order.orderNumber}`);
    return;
  }

  try {
    await getSender().sendMessages(buildOrderPlacedMessage(order));
    console.log(`OrderPlaced event sent for ${order.orderNumber}`);
  } catch (err) {
    console.error(`OrderPlaced event not sent for ${order.orderNumber}: ${err.message}`);
  }
}

// Called on shutdown (SIGTERM), so open connections are closed cleanly.
async function closeEventPublisher() {
  if (sender) {
    await sender.close();
  }
  if (client) {
    await client.close();
  }
  sender = null;
  client = null;
}

module.exports = { publishOrderPlaced, buildOrderPlacedMessage, closeEventPublisher };
