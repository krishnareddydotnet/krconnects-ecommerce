// -----------------------------------------------------------------------
// KRConnects Customer Portal - Catalog API service
//
// This code runs in the user's BROWSER, not inside the Kubernetes cluster.
// So the browser calls "/catalog-api/..." on the same site, and nginx
// (inside the cluster) forwards it to the Catalog API Service:
//   /catalog-api/products/paged  ->  http://catalog-api:8081/products/paged
// -----------------------------------------------------------------------

const CATALOG_API_BASE_URL = import.meta.env.VITE_CATALOG_API_BASE_URL || '/catalog-api';

async function getJson(path) {
  const response = await fetch(`${CATALOG_API_BASE_URL}${path}`);

  if (!response.ok) {
    const error = new Error(`Catalog API returned status ${response.status}`);
    error.status = response.status;   // so callers can check for 404
    throw error;
  }

  return response.json();
}

/**
 * One PAGE of products. Search, category filter and sort are done by the
 * database, so only the products for this page travel over the network.
 * Returns { items, page, pageSize, totalCount, totalPages }.
 */
export function fetchProductsPage({ page = 1, pageSize = 24, search = '', category = 'All', sort = 'featured' }) {
  const params = new URLSearchParams({ page, pageSize, sort });
  if (search.trim() !== '') params.set('search', search.trim());
  if (category !== 'All') params.set('category', category);

  return getJson(`/products/paged?${params.toString()}`);
}

/** One product by id. Throws an error with status 404 if it does not exist. */
export function fetchProduct(id) {
  return getJson(`/products/${id}`);
}

/** Category names, e.g. ["Beauty", "Books", ...] */
export function fetchCategories() {
  return getJson('/products/categories');
}
