import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchProductsPage } from '../services/catalogApiService.js';
import { formatPrice } from '../utils/productUtils.js';
import ProductImage from './ProductImage.jsx';

// -----------------------------------------------------------------------
// SearchBox: the header search input + a "suggestions" dropdown.
//
// - Typing still updates searchText in App (the home page grid filters as before).
// - After the user stops typing for 300 ms (and has typed 2+ letters),
//   we ask catalog-api for the top 5 matches and show them under the box:
//   picture, name (matching letters in bold), category and price.
// - Click a suggestion (or arrow keys + Enter) -> open that product's page.
// - "See all N results" -> close the dropdown and show the full grid.
// - Esc or clicking outside closes the dropdown.
// -----------------------------------------------------------------------

export const SUGGESTION_COUNT = 5;   // how many suggestions to show
const MIN_LETTERS = 2;               // don't suggest for a single letter
const WAIT_MS = 300;                 // wait after the last key press

// Splits a name into parts so the matching letters can be shown in bold.
// highlightMatch('Coffee Table', 'tab') -> ['Coffee ', <b>Tab</b>, 'le']
function highlightMatch(name, text) {
  const start = name.toLowerCase().indexOf(text.toLowerCase());
  if (text === '' || start === -1) return name;

  const end = start + text.length;
  return (
    <>
      {name.slice(0, start)}
      <strong>{name.slice(start, end)}</strong>
      {name.slice(end)}
    </>
  );
}

function SearchBox({ searchText, onSearchChange }) {
  const navigate = useNavigate();
  const boxRef = useRef(null);

  const [suggestions, setSuggestions] = useState([]);   // up to 5 products
  const [totalCount, setTotalCount] = useState(0);      // all matches, for "See all N results"
  const [isOpen, setIsOpen] = useState(false);          // is the dropdown visible?
  const [activeIndex, setActiveIndex] = useState(-1);   // row picked with arrow keys (-1 = none)

  const text = searchText.trim();

  // Ask catalog-api for suggestions, 300 ms after the user stops typing
  useEffect(() => {
    if (text.length < MIN_LETTERS) {
      setSuggestions([]);
      setTotalCount(0);
      return undefined;
    }

    let ignore = false;   // if the user keeps typing, ignore older answers
    const timer = setTimeout(() => {
      // Browser -> /catalog-api/products/paged?search=tab&pageSize=5 -> nginx -> catalog-api
      fetchProductsPage({ page: 1, pageSize: SUGGESTION_COUNT, search: text })
        .then((result) => {
          if (ignore) return;
          setSuggestions(result.items);
          setTotalCount(result.totalCount);
          setActiveIndex(-1);
        })
        .catch(() => {
          if (!ignore) setSuggestions([]);   // suggestions are optional; the grid shows any error
        });
    }, WAIT_MS);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [text]);

  // Close the dropdown when the user clicks anywhere outside the search box
  useEffect(() => {
    function handleClickOutside(event) {
      if (boxRef.current && !boxRef.current.contains(event.target)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function openProduct(product) {
    setIsOpen(false);
    navigate(`/product/${product.id}`);
  }

  function showAllResults() {
    setIsOpen(false);
    navigate('/');   // the home page grid already shows the results for searchText
  }

  // Arrow keys move through the list, Enter opens, Esc closes
  function handleKeyDown(event) {
    if (!isOpen || suggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      openProduct(suggestions[activeIndex]);
    } else if (event.key === 'Escape') {
      setIsOpen(false);
    }
  }

  const showDropdown = isOpen && text.length >= MIN_LETTERS && suggestions.length > 0;

  return (
    <div className="search-box" ref={boxRef}>
      <form className="search" role="search" onSubmit={(e) => e.preventDefault()}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7"></circle>
          <path d="M20 20l-3.5-3.5"></path>
        </svg>
        <label htmlFor="search-input" className="visually-hidden">Search products</label>
        <input
          id="search-input"
          type="search"
          placeholder="Search by name or category"
          autoComplete="off"
          value={searchText}
          onChange={(e) => {
            onSearchChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          // Screen readers: this input controls a list of suggestions
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="search-suggestions"
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined}
        />
      </form>

      {showDropdown && (
        <div className="suggestions">
          <ul id="search-suggestions" role="listbox" aria-label="Search suggestions">
            {suggestions.map((product, index) => (
              <li
                key={product.id}
                id={`suggestion-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className={index === activeIndex ? 'suggestion active' : 'suggestion'}
                // onMouseDown (not onClick) so it runs before the input loses focus
                onMouseDown={(e) => {
                  e.preventDefault();
                  openProduct(product);
                }}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <ProductImage product={product} className="suggestion-image" />
                <div className="suggestion-text">
                  <span className="suggestion-name">{highlightMatch(product.name, text)}</span>
                  <span className="suggestion-category">{product.category}</span>
                </div>
                <span className="suggestion-price">{formatPrice(product.price)}</span>
              </li>
            ))}
          </ul>

          <button type="button" className="suggestion-all" onMouseDown={(e) => e.preventDefault()} onClick={showAllResults}>
            See all {totalCount} results for "{text}" →
          </button>
        </div>
      )}
    </div>
  );
}

export default SearchBox;
