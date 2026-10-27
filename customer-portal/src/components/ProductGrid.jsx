import ProductCard from './ProductCard.jsx';

// ProductGrid: renders one ProductCard per product.
// cartItems looks like { 3: { product, quantity: 2 } }  (product id -> cart line)
function ProductGrid({ products, cartItems, onAddToCart }) {
  return (
    <div className="grid">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          isAdded={Boolean(cartItems[product.id])}
          onAddToCart={onAddToCart}
        />
      ))}
    </div>
  );
}

export default ProductGrid;
