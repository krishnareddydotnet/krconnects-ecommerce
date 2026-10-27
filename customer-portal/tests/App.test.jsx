import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';
import { fakeFetch } from './fakeApi.js';

// App uses routes, so tests wrap it in MemoryRouter (a router without a real browser URL).
function renderApp(url = '/') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <App />
    </MemoryRouter>
  );
}

describe('App (storefront home page)', () => {
  beforeEach(() => {
    global.fetch = vi.fn(fakeFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the loading message first', () => {
    global.fetch = vi.fn(() => new Promise(() => {})); // never answers
    renderApp();
    expect(screen.getByText('Loading products...')).toBeInTheDocument();
  });

  it('shows the first page of products with prices and the page count', async () => {
    renderApp();

    expect(await screen.findByText('Wireless Mouse')).toBeInTheDocument();
    expect(screen.getByText('₹1,599.00')).toBeInTheDocument();
    expect(screen.getByText('Showing 1–24 of 30 products')).toBeInTheDocument();
  });

  it('asks the API for page 1 with 24 products', async () => {
    renderApp();
    await screen.findByText('Wireless Mouse');

    expect(global.fetch).toHaveBeenCalledWith('/catalog-api/products/paged?page=1&pageSize=24&sort=featured');
  });

  it('page 2 button loads the next page', async () => {
    renderApp();
    await screen.findByText('Wireless Mouse');

    fireEvent.click(screen.getByRole('button', { name: 'Page 2' }));

    expect(await screen.findByText('Showing 25–30 of 30 products')).toBeInTheDocument();
    expect(screen.queryByText('Wireless Mouse')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
  });

  it('filters products when the user types in the search box', async () => {
    renderApp();
    await screen.findByText('Wireless Mouse');

    fireEvent.change(screen.getByPlaceholderText('Search by name or category'), {
      target: { value: 'desk' }
    });

    expect(await screen.findByText('Showing 1–1 of 1 products')).toBeInTheDocument();
    expect(screen.getByText('Standing Desk')).toBeInTheDocument();
  });

  it('filters products when a category chip is clicked', async () => {
    renderApp();
    await screen.findByText('Wireless Mouse');

    fireEvent.click(await screen.findByRole('button', { name: 'Furniture' }));

    expect(await screen.findByText('Showing 1–1 of 1 products')).toBeInTheDocument();
    expect(screen.getByText('Standing Desk')).toBeInTheDocument();
  });

  it('shows "No products found" when nothing matches', async () => {
    renderApp();
    await screen.findByText('Wireless Mouse');

    fireEvent.change(screen.getByPlaceholderText('Search by name or category'), {
      target: { value: 'laptop' }
    });

    expect(await screen.findByText('No products found')).toBeInTheDocument();
  });

  it('updates the cart count when Add to cart is clicked', async () => {
    renderApp();
    await screen.findByText('Wireless Mouse');

    fireEvent.click(screen.getAllByRole('button', { name: 'Add to cart' })[0]);

    expect(screen.getByRole('link', { name: 'Cart, 1 items' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Added ✓' })).toBeInTheDocument();
  });

  it('shows an error message when the Catalog API call fails', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 503, json: async () => ({}) }));
    renderApp();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('opens the product details page when a product name is clicked', async () => {
    renderApp();
    await screen.findByText('Wireless Mouse');

    fireEvent.click(screen.getByRole('link', { name: 'Standing Desk' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Standing Desk' })).toBeInTheDocument();
    expect(screen.getByText('₹5,199.00')).toBeInTheDocument();
  });
});
