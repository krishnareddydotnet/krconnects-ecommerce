import { useState } from 'react';

// ProductImage: shows the product photo from Blob Storage (imageUrl).
// If there is no image, or it fails to load, shows the first letter instead.
// loading="lazy" = the browser only downloads images that are near the screen.
function ProductImage({ product, className }) {
  const [failed, setFailed] = useState(false);

  if (!product.imageUrl || failed) {
    return (
      <div className={`${className} image-fallback`} aria-hidden="true">
        {product.name.charAt(0)}
      </div>
    );
  }

  return (
    <img
      className={className}
      src={product.imageUrl}
      alt={product.name}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export default ProductImage;
