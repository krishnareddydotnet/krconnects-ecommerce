// -----------------------------------------------------------------------
// Sends the order confirmation to the customer.
//
// For now "send" = write a clear log line. A real e-mail (for example with
// Azure Communication Services) can be added here later; the rest of the
// service will not need to change.
// -----------------------------------------------------------------------

async function sendOrderConfirmation(event) {
  // Show money with 2 decimals, like the website (₹2597.00)
  const total = Number(event.total).toFixed(2);

  console.log(
    `Order confirmation for ${event.username}: order ${event.orderNumber}, total ₹${total}, ${event.itemCount} item(s)`
  );
}

module.exports = { sendOrderConfirmation };
