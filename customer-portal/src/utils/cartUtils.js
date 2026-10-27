// -----------------------------------------------------------------------
// Cart helpers: work out cart lines and totals, and save the cart in the
// browser so a page refresh doesn't empty it.
//
// The cart is an object:  { productId: { product, quantity } }
//   e.g. { 3: { product: { id: 3, name, category, price, imageUrl }, quantity: 2 } }
// We keep a small copy of each product, because the site no longer loads
// all products at once (only one page at a time).
// (A real checkout re-checks prices on the server - that is order-api's job.)
// -----------------------------------------------------------------------

export const MAX_QUANTITY = 10;              // max of one product per order
export const FREE_DELIVERY_THRESHOLD = 999;  // free delivery above ₹999
export const DELIVERY_FEE = 49;              // otherwise ₹49
// Prices already INCLUDE GST (normal in India), so no tax is added on top.

const CART_KEY = 'krconnects_cart';

// Read the saved cart from the browser.
// Anything in an old or broken format is ignored (empty cart).
export function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY)) || {};
    const cart = {};
    for (const [id, line] of Object.entries(saved)) {
      if (line && line.product && line.quantity > 0) cart[id] = line;
    }
    return cart;
  } catch {
    return {};
  }
}

export function saveCart(cartItems) {
  localStorage.setItem(CART_KEY, JSON.stringify(cartItems));
}

// Only the product fields the cart needs
export function toCartProduct(product) {
  const { id, name, category, price, imageUrl } = product;
  return { id, name, category, price, imageUrl };
}

// Turn the cart object into a list: [{ product, quantity, lineTotal }]
export function getCartLines(cartItems) {
  return Object.values(cartItems).map(({ product, quantity }) => ({
    product,
    quantity,
    lineTotal: product.price * quantity
  }));
}

// Totals for the order summary box
export function getCartSummary(lines) {
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const delivery = subtotal === 0 || subtotal > FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  return { itemCount, subtotal, delivery, total: subtotal + delivery };
}
