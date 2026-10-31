// -----------------------------------------------------------------------
// Order business rules. The route handlers stay thin; the logic is here.
//
// IMPORTANT: we NEVER trust prices from the browser. The browser sends only
// productId + quantity; the name and price come from the Data API.
// -----------------------------------------------------------------------

const crypto = require('node:crypto');
const dataApiClient = require('./dataApiClient');
const { publishOrderPlaced } = require('../events/orderEvents');

// Same limits as the customer portal (customer-portal/src/utils/cartUtils.js)
const MAX_QUANTITY = 10;
const MAX_LINES = 20;

// Same delivery rule as the customer portal, so the total the user saw in
// the cart is the total we save:
//   subtotal above ₹999 -> free delivery, otherwise ₹49.
const FREE_DELIVERY_THRESHOLD = 999;
const DELIVERY_FEE = 49;

// Error with an HTTP status, for problems caused by the caller (e.g. 400).
// The route turns it into a JSON response with this message.
class OrderError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Returns an error message for bad input, or null when the items are fine.
function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return 'items must be a non-empty list.';
  }
  if (items.length > MAX_LINES) {
    return `An order can have at most ${MAX_LINES} different products.`;
  }

  const seen = new Set();
  for (const item of items) {
    if (item === null || typeof item !== 'object') {
      return 'Each item must be an object with productId and quantity.';
    }
    if (!Number.isInteger(item.productId) || item.productId <= 0) {
      return 'productId must be a positive whole number.';
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY) {
      return `quantity must be a whole number from 1 to ${MAX_QUANTITY}.`;
    }
    // The cart has one line per product, so a repeat is a mistake
    if (seen.has(item.productId)) {
      return `Product ${item.productId} is listed more than once.`;
    }
    seen.add(item.productId);
  }

  return null;
}

// Money is calculated in paise (whole numbers), because adding decimals
// in JavaScript can give results like 0.1 + 0.2 = 0.30000000000000004.
function toPaise(rupees) {
  return Math.round(Number(rupees) * 100);
}

function toRupees(paise) {
  return paise / 100;
}

// Delivery for a subtotal (in rupees). Same rule as the customer portal.
function calculateDelivery(subtotal) {
  if (subtotal === 0 || subtotal > FREE_DELIVERY_THRESHOLD) {
    return 0;
  }
  return DELIVERY_FEE;
}

// "KRC-20261031-7QX2PA": date (UTC) + 6 random uppercase letters/digits.
// crypto.randomInt gives unpredictable numbers (Math.random does not).
function generateOrderNumber(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let randomPart = '';
  for (let i = 0; i < 6; i++) {
    randomPart += characters[crypto.randomInt(characters.length)];
  }

  return `KRC-${year}${month}${day}-${randomPart}`;
}

// Place an order for the logged-in user.
// user = { id, username } from the JWT; items = [{ productId, quantity }]
async function placeOrder(user, items) {
  const problem = validateItems(items);
  if (problem) {
    throw new OrderError(400, problem);
  }

  // 1. Look up every product's CURRENT name and price (all at the same time)
  const products = await Promise.all(items.map((item) => dataApiClient.getProduct(item.productId)));

  // 2. Build the order lines with the server's prices
  const lines = [];
  let subtotalPaise = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const product = products[i];

    if (!product) {
      throw new OrderError(400, `Product ${item.productId} does not exist.`);
    }

    const unitPricePaise = toPaise(product.price);
    const lineTotalPaise = unitPricePaise * item.quantity;
    subtotalPaise += lineTotalPaise;

    lines.push({
      productId: item.productId,
      productName: product.name,
      unitPrice: toRupees(unitPricePaise),
      quantity: item.quantity,
      lineTotal: toRupees(lineTotalPaise)
    });
  }

  // 3. Totals
  const subtotal = toRupees(subtotalPaise);
  const delivery = calculateDelivery(subtotal);
  const total = toRupees(subtotalPaise + toPaise(delivery));

  // 4. Save through the Data API (order + items in one transaction there)
  const saved = await dataApiClient.createOrder({
    orderNumber: generateOrderNumber(),
    userId: user.id,
    username: user.username,
    status: 'Placed',
    subtotal: subtotal,
    delivery: delivery,
    total: total,
    items: lines
  });

  // 5. Let the rest of the system know (only a log line for now)
  publishOrderPlaced(saved);

  return saved;
}

// Orders of the logged-in user, newest first (the Data API sorts them)
async function getMyOrders(user) {
  return dataApiClient.getOrdersByUser(user.id);
}

// One order, but ONLY if it belongs to the logged-in user. Otherwise null,
// so the route answers 404 and nobody can find out which order ids exist.
async function getMyOrder(user, orderId) {
  const order = await dataApiClient.getOrderById(orderId);
  if (!order || order.userId !== user.id) {
    return null;
  }
  return order;
}

module.exports = {
  OrderError,
  validateItems,
  calculateDelivery,
  generateOrderNumber,
  placeOrder,
  getMyOrders,
  getMyOrder
};
