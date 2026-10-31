// -----------------------------------------------------------------------
// Order endpoints (all need a logged-in user):
//   POST /orders      -> place an order   body: { items: [{ productId, quantity }] }
//   GET  /orders/my   -> my orders, newest first
//   GET  /orders/:id  -> one of MY orders (404 if missing or someone else's)
// -----------------------------------------------------------------------

const express = require('express');
const { requireLogin } = require('../middleware/auth');
const orderService = require('../services/orderService');

const router = express.Router();

// Every order endpoint needs a valid login token
router.use(requireLogin);

// Shared error handling: our own 400s keep their message; anything else
// (Data API down, timeout...) becomes a friendly 503 without internal details.
function sendError(res, err) {
  if (err instanceof orderService.OrderError) {
    return res.status(err.status).json({ message: err.message });
  }
  console.error(`Order request failed: ${err.message}`);
  return res.status(503).json({ message: 'Orders are not available right now. Please try again later.' });
}

router.post('/', async (req, res) => {
  // req.body is undefined when no JSON body was sent
  const items = req.body ? req.body.items : undefined;

  try {
    const order = await orderService.placeOrder(req.user, items);
    res.status(201).json(order);
  } catch (err) {
    sendError(res, err);
  }
});

// NOTE: "/my" must be registered BEFORE "/:id", otherwise "my" would be
// treated as an order id.
router.get('/my', async (req, res) => {
  try {
    const orders = await orderService.getMyOrders(req.user);
    res.json(orders);
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/:id', async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ message: 'Order id must be a positive whole number.' });
  }

  try {
    const order = await orderService.getMyOrder(req.user, orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }
    res.json(order);
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
