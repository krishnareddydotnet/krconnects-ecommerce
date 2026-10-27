// -----------------------------------------------------------------------
// Small helper for products.
// (Search, category filter, sort and paging now happen in the database,
//  via catalog-api -> data-api, so the browser no longer does them.)
// -----------------------------------------------------------------------

// 1599 -> "₹1,599.00"
export function formatPrice(value) {
  const number = Number(value) || 0;
  return '₹' + number.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
