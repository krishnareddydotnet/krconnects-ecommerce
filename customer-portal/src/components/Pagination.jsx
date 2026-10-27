// Pagination: « Previous  1 … 4 5 6 … 21  Next »
// Shows the first page, the last page, and the pages around the current one.

// Which page buttons to show. "..." means a gap.
// e.g. page 5 of 21 -> [1, '...', 4, 5, 6, '...', 21]
export function getPageNumbers(page, totalPages) {
  const pages = [];
  for (let p = 1; p <= totalPages; p++) {
    const nearCurrent = Math.abs(p - page) <= 1;
    if (p === 1 || p === totalPages || nearCurrent) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }
  return pages;
}

function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;   // one page only: no buttons needed

  return (
    <nav className="pagination" aria-label="Pages">
      <button type="button" className="page-btn" disabled={page === 1}
        onClick={() => onPageChange(page - 1)}>
        Previous
      </button>

      {getPageNumbers(page, totalPages).map((p, index) =>
        p === '...' ? (
          <span key={`gap-${index}`} className="page-gap" aria-hidden="true">…</span>
        ) : (
          <button
            key={p}
            type="button"
            className="page-btn"
            aria-label={`Page ${p}`}
            aria-current={p === page ? 'page' : undefined}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        )
      )}

      <button type="button" className="page-btn" disabled={page === totalPages}
        onClick={() => onPageChange(page + 1)}>
        Next
      </button>
    </nav>
  );
}

export default Pagination;
