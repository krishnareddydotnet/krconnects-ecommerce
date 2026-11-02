// -----------------------------------------------------------------------
// KRConnects Customer Portal - Order API service
//
// This code runs in the user's BROWSER, not inside the Kubernetes cluster,
// so it calls "/order-api/..." on the same site. nginx (inside the cluster)
// forwards it to the Order API Service (see nginx.conf):
//   /order-api/orders  ->  http://order-api:8082/orders
//
// Every order call needs the login token (the JWT saved after login).
// -----------------------------------------------------------------------

const ORDER_API_BASE_URL = import.meta.env.VITE_ORDER_API_BASE_URL || '/order-api';

/**
 * Place an order. Sends ONLY productId + quantity: the server looks up the
 * real prices itself, so a changed price in the browser can't be used.
 * Returns the SAVED order: { orderNumber, subtotal, delivery, total, items, ... }.
 * Throws an Error with .status (e.g. 401 = not logged in, 400 = bad cart).
 */
export async function placeOrder(token, lines) {
  const items = lines.map((line) => ({ productId: line.product.id, quantity: line.quantity }));

  const response = await fetch(`${ORDER_API_BASE_URL}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ items })
  });

  const data = await response.json().catch(() => ({})); // body may be empty

  if (!response.ok) {
    const error = new Error(data.message || `Order API returned status ${response.status}`);
    error.status = response.status;   // so the caller can react to 401
    throw error;
  }

  return data;
}
