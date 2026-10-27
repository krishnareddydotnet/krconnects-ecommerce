import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';
import { fakeFetch } from './fakeApi.js';

// Open the site directly on a URL, like typing it in the browser
function renderAt(url) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <App />
    </MemoryRouter>
  );
}

describe('ProductDetailsPage', () => {
  beforeEach(() => {
    global.fetch = vi.fn(fakeFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads the product from the API by the id in the URL', async () => {
    renderAt('/product/3');

    expect(await screen.findByRole('heading', { level: 1, name: 'Noise Cancelling Headphones' })).toBeInTheDocument();
    expect(screen.getByText('₹1,799.00')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/catalog-api/products/3');
  });

  it('shows similar products from the same category (not itself)', async () => {
    renderAt('/product/3');

    expect(await screen.findByRole('heading', { name: 'Similar products' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Wireless Mouse/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Standing Desk/ })).not.toBeInTheDocument();
  });

  it('adds the chosen quantity to the cart', async () => {
    renderAt('/product/3');
    await screen.findByRole('heading', { level: 1 });

    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));

    expect(screen.getByRole('link', { name: 'Cart, 3 items' })).toBeInTheDocument();
  });

  it('does not go below quantity 1', async () => {
    renderAt('/product/3');
    await screen.findByRole('heading', { level: 1 });

    fireEvent.click(screen.getByRole('button', { name: 'Decrease quantity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));

    expect(screen.getByRole('link', { name: 'Cart, 1 items' })).toBeInTheDocument();
  });

  it('shows "Product not found" for an unknown id', async () => {
    renderAt('/product/999');
    expect(await screen.findByText('Product not found')).toBeInTheDocument();
  });

  it('shows "Page not found" for an unknown URL', async () => {
    renderAt('/abc');
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
  });
});
