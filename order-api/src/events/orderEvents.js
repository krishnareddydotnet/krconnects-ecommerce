// -----------------------------------------------------------------------
// Order events: tell the rest of the system that something happened.
//
// For now this only writes a log line.
// TODO (notification-service step): send an "OrderPlaced" message to
// Azure Service Bus here, so a notification-service can e-mail the
// customer. The rest of order-api will not need to change.
// -----------------------------------------------------------------------

function publishOrderPlaced(order) {
  console.log(`OrderPlaced ${order.orderNumber}`);
}

module.exports = { publishOrderPlaced };
