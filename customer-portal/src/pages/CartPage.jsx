import { Link } from 'react-router-dom';
import { formatPrice } from '../utils/productUtils.js';
import { FREE_DELIVERY_THRESHOLD, MAX_QUANTITY, getCartLines, getCartSummary } from '../utils/cartUtils.js';
import ProductImage from '../components/ProductImage.jsx';

// CartPage ( URL: /cart ) — items with quantity +/-, remove, and the order summary.
function CartPage({ cartItems, currentUser, onQuantityChange, onRemove, onLoginClick, onPlaceOrder }) {
  const lines = getCartLines(cartItems);
  const summary = getCartSummary(lines);

  // ----- Empty cart -----
  if (lines.length === 0) {
    return (
      <div className="empty">
        <h2>Your cart is empty</h2>
        <p>Add something you like and it will show up here.</p>
        <p><Link to="/" className="btn btn-primary btn-link">Continue shopping</Link></p>
      </div>
    );
  }

  // How much more to spend for free delivery (0 if already free)
  const moreForFreeDelivery = summary.delivery > 0 ? FREE_DELIVERY_THRESHOLD + 1 - summary.subtotal : 0;

  return (
    <>
      <div className="toolbar">
        <h1 className="page-title">Your cart</h1>
        <p className="count">{summary.itemCount} {summary.itemCount === 1 ? 'item' : 'items'}</p>
      </div>

      <div className="cart-layout">
        {/* ----- Left: one row per product ----- */}
        <ul className="cart-list">
          {lines.map(({ product, quantity, lineTotal }) => (
            <li key={product.id} className="cart-row">
              <Link to={`/product/${product.id}`} className="cart-thumb-link" aria-hidden="true" tabIndex={-1}>
                <ProductImage product={product} className="cart-thumb" />
              </Link>

              <div className="cart-info">
                <Link to={`/product/${product.id}`} className="card-link cart-name">{product.name}</Link>
                <span className="cart-meta">{product.category} · {formatPrice(product.price)} each</span>
              </div>

              <div className="qty qty-small" role="group" aria-label={`Quantity of ${product.name}`}>
                <button type="button" aria-label={`Decrease ${product.name}`}
                  onClick={() => onQuantityChange(product.id, quantity - 1)}>−</button>
                <span>{quantity}</span>
                <button type="button" aria-label={`Increase ${product.name}`}
                  disabled={quantity >= MAX_QUANTITY}
                  onClick={() => onQuantityChange(product.id, quantity + 1)}>+</button>
              </div>

              <span className="cart-line-total">{formatPrice(lineTotal)}</span>

              <button type="button" className="btn btn-ghost cart-remove"
                aria-label={`Remove ${product.name}`} onClick={() => onRemove(product)}>
                Remove
              </button>
            </li>
          ))}
        </ul>

        {/* ----- Right: order summary ----- */}
        <aside className="summary" aria-labelledby="summary-title">
          <h2 id="summary-title">Order summary</h2>
          <div className="summary-row"><span>Subtotal</span><span>{formatPrice(summary.subtotal)}</span></div>
          <div className="summary-row">
            <span>Delivery</span>
            <span>{summary.delivery === 0 ? 'Free' : formatPrice(summary.delivery)}</span>
          </div>
          {moreForFreeDelivery > 0 && (
            <p className="summary-hint">Add {formatPrice(moreForFreeDelivery)} more for free delivery.</p>
          )}
          <div className="summary-row summary-total"><span>Total</span><span>{formatPrice(summary.total)}</span></div>
          <p className="summary-hint">Inclusive of all taxes</p>

          {/* Must be logged in to place an order */}
          {currentUser ? (
            <button type="button" className="btn btn-primary summary-btn" onClick={() => onPlaceOrder(lines, summary)}>
              Place order
            </button>
          ) : (
            <button type="button" className="btn btn-primary summary-btn" onClick={onLoginClick}>
              Log in to place your order
            </button>
          )}
          <Link to="/" className="summary-continue">Continue shopping</Link>
        </aside>
      </div>
    </>
  );
}

export default CartPage;
