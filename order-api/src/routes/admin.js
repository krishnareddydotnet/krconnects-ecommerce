// -----------------------------------------------------------------------
// Admin order endpoints (for the admin portal). Login AND role "admin" needed:
//   GET   /admin/orders?page=1&pageSize=20  -> all orders, newest first
//   PATCH /admin/orders/:id/status          -> change the status  body: { status }
//
// No token / bad token -> 401, logged in but not admin -> 403.
// The check is HERE in the backend, not only in the admin portal's UI.
// -----------------------------------------------------------------------

const express = require('express');
const { requireLogin, requireAdmin } = require('../middleware/auth');
const dataApiClient = require('../services/dataApiClient');

const router = express.Router();

// The statuses an order can have (the Data API checks the same list)
const ALLOWED_STATUSES = ['Placed', 'Shipped', 'Delivered', 'Cancelled'];
const MAX_PAGE_SIZE = 100;

// Order matters: first "who are you?" (401), then "are you allowed?" (403)
router.use(requireLogin);
router.use(requireAdmin);

// Reads a query value like "2" as a whole number >= 1, or returns null
function readPositiveInteger(value, defaultValue) {
  if (value === undefined) {
    return defaultValue;
  }
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    return null;
  }
  return number;
}

function dataApiDown(res, err) {
  console.error(`Admin request failed: ${err.message}`);
  return res.status(503).json({ message: 'Orders are not available right now. Please try again later.' });
}

router.get('/orders', async (req, res) => {
  const page = readPositiveInteger(req.query.page, 1);
  const pageSize = readPositiveInteger(req.query.pageSize, 20);

  if (page === null) {
    return res.status(400).json({ message: 'page must be a whole number of 1 or more.' });
  }
  if (pageSize === null || pageSize > MAX_PAGE_SIZE) {
    return res.status(400).json({ message: `pageSize must be a whole number from 1 to ${MAX_PAGE_SIZE}.` });
  }

  try {
    const result = await dataApiClient.getOrdersPage(page, pageSize);
    res.json(result);
  } catch (err) {
    dataApiDown(res, err);
  }
});

router.patch('/orders/:id/status', async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ message: 'Order id must be a positive whole number.' });
  }

  const status = req.body ? req.body.status : undefined;
  if (!ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ message: `status must be one of: ${ALLOWED_STATUSES.join(', ')}.` });
  }

  try {
    const order = await dataApiClient.updateOrderStatus(orderId, status);
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }
    // Log who changed what (admin username is not a secret; useful for auditing)
    console.log(`Order ${order.orderNumber} status -> ${status} by ${req.user.username}`);
    res.json(order);
  } catch (err) {
    dataApiDown(res, err);
  }
});

module.exports = router;
