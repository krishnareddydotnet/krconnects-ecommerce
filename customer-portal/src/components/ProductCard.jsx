import { Link } from 'react-router-dom';
import { formatPrice } from '../utils/productUtils.js';
import ProductImage from './ProductImage.jsx';

// ProductCard: one product in the grid.
// Clicking the image or the name opens the product details page (/product/:id).
// The button changes to "Added ✓" (soft green) once the product is in the cart.
function ProductCard({ product, isAdded, onAddToCart }) {
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
        {/* Outline pill button: fills on hover, turns soft green once added */}
        <button
          type="button"
          className={isAdded ? 'btn card-btn added' : 'btn card-btn'}
          onClick={() => onAddToCart(product, 1)}
          disabled={isAdded}
        >
          {/* Small cart icon (decorative only, so screen readers skip it) */}
          {!isAdded && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"></path>
              <circle cx="10" cy="20" r="1.2"></circle>
              <circle cx="17" cy="20" r="1.2"></circle>
            </svg>
          )}
          {isAdded ? 'Added ✓' : 'Add to cart'}
        </button>
      </div>
    </article>
  );
}

export default ProductCard;
