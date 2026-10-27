import { useEffect, useState } from 'react';
import { fetchProductsPage } from '../services/catalogApiService.js';
import Intro from '../components/Intro.jsx';
import CategoryBar from '../components/CategoryBar.jsx';
import ProductToolbar from '../components/ProductToolbar.jsx';
import ProductGrid from '../components/ProductGrid.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Pagination from '../components/Pagination.jsx';

export const PAGE_SIZE = 24;   // products per page

// HomePage ( URL: / ) — category chips, toolbar, ONE page of products, and page buttons.
// Every change (page, category, search, sort) asks the API for the matching page.
function HomePage({ categories, selectedCategory, onCategoryChange, searchText, sortBy, onSortChange,
                    page, onPageChange, cartItems, onAddToCart }) {
  const [result, setResult] = useState(null);   // { items, totalCount, totalPages, ... }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Wait until the user stops typing for 300 ms before searching,
  // so we don't call the API on every key press.
  const [debouncedSearch, setDebouncedSearch] = useState(searchText);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Load the page whenever page / category / search / sort changes
  useEffect(() => {
    let ignore = false;   // if the user clicks again quickly, ignore the older answer
    setLoading(true);
    setError(null);

    fetchProductsPage({ page, pageSize: PAGE_SIZE, search: debouncedSearch, category: selectedCategory, sort: sortBy })
      .then((data) => { if (!ignore) setResult(data); })
      .catch((err) => { if (!ignore) setError(err.message); })
      .finally(() => { if (!ignore) setLoading(false); });

    return () => { ignore = true; };
  }, [page, debouncedSearch, selectedCategory, sortBy]);

  function goToPage(newPage) {
    onPageChange(newPage);
    window.scrollTo(0, 0);   // start the new page at the top
  }

  const title = selectedCategory === 'All' ? 'All products' : selectedCategory;

  // Main area: error -> first load -> products (or empty state)
  let content;
  if (error) {
    content = (
      <p className="status error" role="alert">
        Sorry, we couldn't load products right now. ({error})
      </p>
    );
  } else if (!result) {
    content = <p className="status">Loading products...</p>;
  } else {
    content = (
      <>
        <ProductToolbar
          title={title}
          page={result.page}
          pageSize={PAGE_SIZE}
          shownCount={result.items.length}
          totalCount={result.totalCount}
          sortBy={sortBy}
          onSortChange={onSortChange}
        />
        {result.items.length > 0 ? (
          // Slightly faded while the next page is loading
          <div className={loading ? 'is-loading' : ''}>
            <ProductGrid products={result.items} cartItems={cartItems} onAddToCart={onAddToCart} />
          </div>
        ) : (
          <EmptyState />
        )}
        <Pagination page={result.page} totalPages={result.totalPages} onPageChange={goToPage} />
      </>
    );
  }

  return (
    <>
      <Intro />
      <CategoryBar categories={categories} selectedCategory={selectedCategory} onSelect={onCategoryChange} />
      {content}
    </>
  );
}

export default HomePage;
