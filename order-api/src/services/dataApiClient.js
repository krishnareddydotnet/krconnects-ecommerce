// -----------------------------------------------------------------------
// Calls the Data API over HTTP.
// The Data API is the ONLY service that talks to the database, so
// order-api never connects to Azure SQL itself.
//
// Address: env var DATA_API_URL (default http://data-api:8080 = the
// Kubernetes Service name).
//
// Functions return the data, or null for "not found" (404).
// Any other problem (Data API down, 500, timeout) throws an Error.
// -----------------------------------------------------------------------

// Don't wait forever if the Data API is down (same as auth-api: 5 seconds)
const TIMEOUT_MS = 5000;

function baseUrl() {
  return process.env.DATA_API_URL || 'http://data-api:8080';
}

// Small helper: call the Data API and return { status, body }
async function callDataApi(method, path, body) {
  const options = {
    method: method,
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  };

  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(baseUrl() + path, options);
  const data = await response.json().catch(() => null);   // body may be empty
  return { status: response.status, body: data };
}

// GET /products/{id} -> the product (with its CURRENT price), or null
async function getProduct(productId) {
  const result = await callDataApi('GET', `/products/${productId}`);
  if (result.status === 404) return null;
  if (result.status !== 200) {
    throw new Error(`Data API GET /products/${productId} returned ${result.status}`);
  }
  return result.body;
}

// POST /orders -> the saved order (with id, createdAt and items)
async function createOrder(order) {
  const result = await callDataApi('POST', '/orders', order);
  if (result.status !== 201) {
    throw new Error(`Data API POST /orders returned ${result.status}`);
  }
  return result.body;
}

// GET /orders/user/{userId} -> list of orders, newest first
async function getOrdersByUser(userId) {
  const result = await callDataApi('GET', `/orders/user/${userId}`);
  if (result.status !== 200) {
    throw new Error(`Data API GET /orders/user/${userId} returned ${result.status}`);
  }
  return result.body;
}

// GET /orders/{id} -> one order, or null
async function getOrderById(orderId) {
  const result = await callDataApi('GET', `/orders/${orderId}`);
  if (result.status === 404) return null;
  if (result.status !== 200) {
    throw new Error(`Data API GET /orders/${orderId} returned ${result.status}`);
  }
  return result.body;
}

// Used by the readiness probe: is the Data API answering at all?
async function isReachable() {
  try {
    const result = await callDataApi('GET', '/health/live');
    return result.status === 200;
  } catch {
    return false;
  }
}

// Exported as one object so tests can replace single functions (mocking)
module.exports = {
  getProduct,
  createOrder,
  getOrdersByUser,
  getOrderById,
  isReachable
};
