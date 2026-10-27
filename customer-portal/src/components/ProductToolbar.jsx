// ProductToolbar: section title, "Showing 25–48 of 500 products", and the Sort by dropdown.
function ProductToolbar({ title, page, pageSize, shownCount, totalCount, sortBy, onSortChange }) {
  // Position of the first and last product on this page, e.g. page 2 -> 25 to 48
  const first = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = (page - 1) * pageSize + shownCount;

  return (
    <div className="toolbar">
      <h2>{title}</h2>
      <div className="toolbar-right">
        <p className="count" aria-live="polite">
          Showing {first}–{last} of {totalCount} products
        </p>
        <div className="sort">
          <label htmlFor="sort">Sort by</label>
          <select id="sort" value={sortBy} onChange={(e) => onSortChange(e.target.value)}>
            <option value="featured">Featured</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="name-asc">Name: A to Z</option>
          </select>
        </div>
      </div>
    </div>
  );
}

export default ProductToolbar;
