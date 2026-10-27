import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchProduct, fetchProductsPage } from '../services/catalogApiService.js';
import { formatPrice } from '../utils/productUtils.js';
import { MAX_QUANTITY } from '../utils/cartUtils.js';
import ProductImage from '../components/ProductImage.jsx';

// ProductDetailsPage ( URL: /product/:id ) — one product with quantity + Add to cart,
// and "Similar products" from the same category underneath.
// The product is loaded from the API by its id: GET /catalog-api/products/{id}
function ProductDetailsPage({ onAddToCart, onCategoryChange }) {
  const { id } = useParams();               // "3" from /product/3 (always a string)
  const [product, setProduct] = useState(null);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [status, setStatus] = useState('loading');   // 'loading' | 'ready' | 'not-found' | 'error'
  const [quantity, setQuantity] = useState(1);

  // Load the product (and its similar products) whenever the id in the URL changes
  useEffect(() => {
    let ignore = false;
    window.scrollTo(0, 0);
    setQuantity(1);
    setStatus('loading');

    fetchProduct(id)
      .then((data) => {
        if (ignore) return;
        setProduct(data);
        setStatus('ready');

        // 5 from the same category; drop this product and keep 4
        return fetchProductsPage({ page: 1, pageSize: 5, category: data.category }).then((page) => {
          if (!ignore) setSimilarProducts(page.items.filter((p) => p.id !== data.id).slice(0, 4));
        });
      })
      .catch((err) => {
        if (!ignore) setStatus(err.status === 404 || err.status === 400 ? 'not-found' : 'error');
      });

    return () => { ignore = true; };
  }, [id]);

  if (status === 'loading') {
    return <p className="status">Loading product...</p>;
  }

  if (status === 'error') {
    return <p className="status error" role="alert">Sorry, we couldn't load this product right now.</p>;
  }

  // Wrong id in the URL (e.g. /product/999)
  if (status === 'not-found') {
    return (
      <div className="empty">
        <h2>Product not found</h2>
        <p>This product doesn't exist or is no longer available.</p>
        <p><Link to="/">Back to all products</Link></p>
      </div>
    );
  }

  return (
    <>
      {/* Breadcrumb: Home › Category › Product */}
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/" onClick={() => onCategoryChange('All')}>Home</Link>
        <span aria-hidden="true">›</span>
        <Link to="/" onClick={() => onCategoryChange(product.category)}>{product.category}</Link>
        <span aria-hidden="true">›</span>
        <span aria-current="page">{product.name}</span>
      </nav>

      <section className="details">
        <ProductImage product={product} className="details-image" />

        <div className="details-info">
          <span className="tag">{product.category}</span>
          <h1>{product.name}</h1>
          <p className="details-price">{formatPrice(product.price)}</p>
          <p className="details-note">Free delivery above ₹999 · Product ID {product.id}</p>

          <div className="details-actions">
            {/* Quantity: between 1 and 10 */}
            <div className="qty" role="group" aria-label="Quantity">
              <button type="button" aria-label="Decrease quantity"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button>
              <span aria-live="polite">{quantity}</span>
              <button type="button" aria-label="Increase quantity"
                onClick={() => setQuantity(Math.min(MAX_QUANTITY, quantity + 1))}>+</button>
            </div>
            <button type="button" className="btn btn-primary details-add"
              onClick={() => onAddToCart(product, quantity)}>
              Add to cart
            </button>
          </div>
        </div>
      </section>

      {similarProducts.length > 0 && (
        <section className="similar" aria-labelledby="similar-title">
          <h2 id="similar-title">Similar products</h2>
          <div className="similar-grid">
            {similarProducts.map((p) => (
              <Link key={p.id} to={`/product/${p.id}`} className="similar-card">
                <ProductImage product={p} className="similar-image" />
                <span className="similar-name">{p.name}</span>
                <span className="similar-price">{formatPrice(p.price)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export default ProductDetailsPage;
