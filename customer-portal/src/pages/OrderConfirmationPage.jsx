import { Link } from 'react-router-dom';
import { formatPrice } from '../utils/productUtils.js';

// OrderConfirmationPage ( URL: /order-confirmation )
// Shows the order as SAVED by the Order API: the order number, prices and
// totals come from the server's response, not from the browser's cart.
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

      <ul className="confirmation-list">
        {order.items.map((item) => (
          <li key={item.productId}>
            <span>{item.quantity} × {item.productName}</span>
            <span>{formatPrice(item.lineTotal)}</span>
          </li>
        ))}
        <li><span>Subtotal</span><span>{formatPrice(order.subtotal)}</span></li>
        <li><span>Delivery</span><span>{order.delivery === 0 ? 'Free' : formatPrice(order.delivery)}</span></li>
        <li className="summary-total"><span>Total paid</span><span>{formatPrice(order.total)}</span></li>
      </ul>

      <Link to="/" className="btn btn-primary btn-link">Continue shopping</Link>
    </section>
  );
}

export default OrderConfirmationPage;
