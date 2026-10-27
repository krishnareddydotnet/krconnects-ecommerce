import { Link } from 'react-router-dom';
import { formatPrice } from '../utils/productUtils.js';

// OrderConfirmationPage ( URL: /order-confirmation )
// DEMO ONLY: there is no order-api yet, so the order is not saved anywhere.
// Later: "Place order" -> POST /order-api/orders, and this page shows the saved order.
function OrderConfirmationPage({ order }) {
  // Opened directly or after a refresh: we don't have the order any more
  if (!order) {
    return (
      <div className="empty">
        <h2>No recent order</h2>
        <p><Link to="/">Continue shopping</Link></p>
      </div>
    );
  }

  return (
    <section className="confirmation">
      <div className="confirmation-icon" aria-hidden="true">✓</div>
      <h1>Thank you, {order.username}!</h1>
      <p className="confirmation-number">Order number <strong>{order.orderNumber}</strong></p>
      <p className="summary-hint">Demo order: not saved yet (order-api is coming next).</p>

      <ul className="confirmation-list">
        {order.lines.map(({ product, quantity, lineTotal }) => (
          <li key={product.id}>
            <span>{quantity} × {product.name}</span>
            <span>{formatPrice(lineTotal)}</span>
          </li>
        ))}
        <li><span>Delivery</span><span>{order.summary.delivery === 0 ? 'Free' : formatPrice(order.summary.delivery)}</span></li>
        <li className="summary-total"><span>Total paid</span><span>{formatPrice(order.summary.total)}</span></li>
      </ul>

      <Link to="/" className="btn btn-primary btn-link">Continue shopping</Link>
    </section>
  );
}

export default OrderConfirmationPage;
