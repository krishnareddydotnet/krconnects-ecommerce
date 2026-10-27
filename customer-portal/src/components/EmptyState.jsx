// EmptyState: shown when search + category filter match nothing.
function EmptyState() {
  return (
    <div className="empty">
      <h2>No products found</h2>
      <p>Try a different search or choose another category.</p>
    </div>
  );
}

export default EmptyState;
