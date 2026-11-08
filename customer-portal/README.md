# krconnects-customer-portal
Customer-facing web application for KRConnects, built with React. Provides external customers with self-service access to their account, orders, and services.

## Search suggestions (v1.11.0)

Typing 2 or more letters in the header search box shows up to 5 matching products under the box
(picture, name with the matching letters in bold, category and price), plus "See all N results".

- Waits 300 ms after the last key press, then calls `/catalog-api/products/paged?search=<text>&pageSize=5`
  (no catalog-api change needed).
- Click a suggestion, or use arrow keys + Enter, to open that product. Esc or clicking outside closes the list.
- Code: `src/components/SearchBox.jsx` (used by `Header.jsx`), styles under "Search suggestions" in `src/styles/app.css`,
  tests in `tests/SearchBox.test.jsx`.
