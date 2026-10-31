import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';
import { fakeFetch } from './fakeApi.js';

const mouse = { id: 1, name: 'Wireless Mouse', category: 'Electronics', price: 1599, imageUrl: null };
const book = { id: 4, name: 'Clean Code', category: 'Books', price: 499, imageUrl: null };

// Open the site at a URL, with a cart already saved in the browser.
// cart = { productId: quantity } for short; turned into the saved format here.
function renderWithCart(url, cart) {
  const saved = {};
  for (const [id, quantity] of Object.entries(cart)) {
    saved[id] = { product: [mouse, book].find((p) => p.id === Number(id)), quantity };
  }
  localStorage.setItem('krconnects_cart', JSON.stringify(saved));

  return render(
    <MemoryRouter initialEntries={[url]}>
      <App />
    </MemoryRouter>
  );
}

describe('CartPage', () => {
  beforeEach(() => {
    global.fetch = vi.fn(fakeFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clicking the cart icon opens the cart page', async () => {
    renderWithCart('/', { 1: 2 });
    await screen.findAllByText('Wireless Mouse');

    fireEvent.click(screen.getByRole('link', { name: 'Cart, 2 items' }));

    expect(screen.getByRole('heading', { name: 'Your cart' })).toBeInTheDocument();
  });

  it('shows the empty cart message', async () => {
    renderWithCart('/cart', {});
    expect(await screen.findByText('Your cart is empty')).toBeInTheDocument();
  });

  it('shows items, line totals and free delivery above ₹999', async () => {
    renderWithCart('/cart', { 1: 2 });   // 2 x 1599 = 3198

    expect(await screen.findByRole('heading', { name: 'Your cart' })).toBeInTheDocument();
    expect(screen.getAllByText('₹3,198.00').length).toBeGreaterThan(0);
    expect(screen.getByText('Free')).toBeInTheDocument();
  });

  it('charges ₹49 delivery for small orders', async () => {
    renderWithCart('/cart', { 4: 1 });   // 499 -> + 49 = 548

    expect(await screen.findByText('₹49.00')).toBeInTheDocument();
    expect(screen.getByText('₹548.00')).toBeInTheDocument();
  });

  it('+ and − change the quantity and the cart count', async () => {
    renderWithCart('/cart', { 1: 1 });
    await screen.findByRole('heading', { name: 'Your cart' });

    fireEvent.click(screen.getByRole('button', { name: 'Increase Wireless Mouse' }));
    expect(screen.getByRole('link', { name: 'Cart, 2 items' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Decrease Wireless Mouse' }));
    expect(screen.getByRole('link', { name: 'Cart, 1 items' })).toBeInTheDocument();
  });

  it('Remove takes the product out of the cart', async () => {
    renderWithCart('/cart', { 1: 1 });
    await screen.findByRole('heading', { name: 'Your cart' });

    fireEvent.click(screen.getByRole('button', { name: 'Remove Wireless Mouse' }));

    expect(screen.getByText('Your cart is empty')).toBeInTheDocument();
  });

  it('keeps the cart after a refresh (saved in the browser)', async () => {
    renderWithCart('/', {});
    await screen.findByText('Wireless Mouse');

    fireEvent.click(screen.getAllByRole('button', { name: 'Add to cart' })[0]);

    const saved = JSON.parse(localStorage.getItem('krconnects_cart'));
    expect(saved[1].quantity).toBe(1);
    expect(saved[1].product.name).toBe('Wireless Mouse');
  });

  it('ignores a cart saved in an old format', async () => {
    localStorage.setItem('krconnects_cart', JSON.stringify({ 1: 2 }));   // old: { id: quantity }
    render(<MemoryRouter initialEntries={['/cart']}><App /></MemoryRouter>);

    expect(await screen.findByText('Your cart is empty')).toBeInTheDocument();
  });

  it('asks to log in before placing an order', async () => {
    renderWithCart('/cart', { 1: 1 });

    expect(await screen.findByRole('button', { name: 'Log in to place your order' })).toBeInTheDocument();
  });

  it('logged-in user places an order: saved order is shown and the cart is emptied', async () => {
    localStorage.setItem('krconnects_token', 'test-token');
    renderWithCart('/cart', { 1: 1, 4: 2 });   // 1599 + 2 x 499 = 2597

    fireEvent.click(await screen.findByRole('button', { name: 'Place order' }));

    expect(await screen.findByRole('heading', { name: 'Thank you, krishna!' })).toBeInTheDocument();
    // order number and totals come from the Order API response
    expect(screen.getByText('KRC-20261031-TEST01')).toBeInTheDocument();
    expect(screen.getByText('2 × Clean Code')).toBeInTheDocument();
    expect(screen.getAllByText('₹2,597.00').length).toBe(2);   // subtotal + total paid
    expect(screen.getByRole('link', { name: 'Cart, 0 items' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('krconnects_cart'))).toEqual({});
  });

  it('sends only productId + quantity, with the login token', async () => {
    localStorage.setItem('krconnects_token', 'test-token');
    renderWithCart('/cart', { 1: 3 });

    fireEvent.click(await screen.findByRole('button', { name: 'Place order' }));
    await screen.findByRole('heading', { name: 'Thank you, krishna!' });

    const [url, options] = global.fetch.mock.calls.find(([u]) => u === '/order-api/orders');
    expect(url).toBe('/order-api/orders');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer test-token');
    expect(JSON.parse(options.body)).toEqual({ items: [{ productId: 1, quantity: 3 }] });   // no prices
  });

  it('shows a friendly message and keeps the cart when the order fails', async () => {
    localStorage.setItem('krconnects_token', 'test-token');
    global.fetch = vi.fn((url, options) => url === '/order-api/orders'
      ? Promise.resolve({ ok: false, status: 503, json: async () => ({ message: 'down' }) })
      : fakeFetch(url, options));
    renderWithCart('/cart', { 1: 1 });

    fireEvent.click(await screen.findByRole('button', { name: 'Place order' }));

    expect(await screen.findByText('Sorry, we could not place your order. Please try again.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your cart' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cart, 1 items' })).toBeInTheDocument();
  });

  it('asks to log in again when the login has expired (401)', async () => {
    localStorage.setItem('krconnects_token', 'test-token');
    global.fetch = vi.fn((url, options) => url === '/order-api/orders'
      ? Promise.resolve({ ok: false, status: 401, json: async () => ({}) })
      : fakeFetch(url, options));
    renderWithCart('/cart', { 1: 1 });

    fireEvent.click(await screen.findByRole('button', { name: 'Place order' }));

    expect(await screen.findByText('Your session has expired. Please log in again.')).toBeInTheDocument();
    expect(localStorage.getItem('krconnects_token')).toBeNull();
    expect(screen.getByRole('link', { name: 'Cart, 1 items' })).toBeInTheDocument();   // cart kept
  });
});
