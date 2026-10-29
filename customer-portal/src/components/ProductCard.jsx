import { Link } from 'react-router-dom';
import { formatPrice } from '../utils/productUtils.js';
import ProductImage from './ProductImage.jsx';

// ProductCard: one product in the grid.
// Clicking the image or the name opens the product details page (/product/:id).
// - Not in the cart: one "Add to cart" button.
// - In the cart: "Added ✓" (soft green) plus a "Remove" button to take it out again.
function ProductCard({ product, isAdded, onAddToCart, onRemoveFromCart }) {
  const detailsUrl = `/product/${product.id}`;

  return (
    <article className="card">
      {/* Product photo (or first letter if there is no image) */}
      <Link to={detailsUrl} className="card-image-link" tabIndex={-1} aria-hidden="true">
        <ProductImage product={product} className="card-image" />
      </Link>

      <div className="card-body">
        <span className="tag">{product.category}</span>
        <h3><Link to={detailsUrl} className="card-link">{product.name}</Link></h3>
        <p className="price">{formatPrice(product.price)}</p>

        {isAdded ? (
          // Already in the cart: show the status and a way to undo it
          <div className="card-actions">
            <button type="button" className="btn card-btn added" disabled>
              Added ✓
            </button>
            <button
              type="button"
              className="btn card-remove-btn"
              onClick={() => onRemoveFromCart(product)}
              aria-label={`Remove ${product.name} from cart`}
            >
              Remove
            </button>
          </div>
        ) : (
          // Not in the cart yet: outline pill button with a cart icon
          <button
            type="button"
            className="btn card-btn"
            onClick={() => onAddToCart(product, 1)}
          >
            {/* Small cart icon (decorative only, so screen readers skip it) */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"></path>
              <circle cx="10" cy="20" r="1.2"></circle>
              <circle cx="17" cy="20" r="1.2"></circle>
            </svg>
            Add to cart
          </button>
        )}
      </div>
    </article>
  );
}

export default ProductCard;
