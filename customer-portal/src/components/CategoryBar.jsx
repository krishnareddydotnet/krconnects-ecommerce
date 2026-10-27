// CategoryBar: one chip per category. The selected chip has aria-pressed="true".
function CategoryBar({ categories, selectedCategory, onSelect }) {
  return (
    <nav className="categories" aria-label="Product categories">
      {categories.map((name) => (
        <button
          key={name}
          type="button"
          className="chip"
          aria-pressed={name === selectedCategory}
          onClick={() => onSelect(name)}
        >
          {name}
        </button>
      ))}
    </nav>
  );
}

export default CategoryBar;
