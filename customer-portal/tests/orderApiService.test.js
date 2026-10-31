import { describe, it, expect, vi, afterEach } from 'vitest';
import { placeOrder } from '../src/services/orderApiService.js';

const lines = [
  { product: { id: 1, name: 'Wireless Mouse', price: 1599 }, quantity: 2, lineTotal: 3198 }
];

describe('orderApiService.placeOrder', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('POSTs only productId + quantity with the Bearer token and returns the saved order', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true, status: 201, json: async () => ({ orderNumber: 'KRC-20261031-ABC123' })
    }));

    const order = await placeOrder('my-token', lines);

    expect(order.orderNumber).toBe('KRC-20261031-ABC123');
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('/order-api/orders');
    expect(options.headers.Authorization).toBe('Bearer my-token');
    expect(JSON.parse(options.body)).toEqual({ items: [{ productId: 1, quantity: 2 }] });
  });

  it('throws an error with the status and the API message', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: false, status: 400, json: async () => ({ message: 'Product 1 does not exist.' })
    }));

    await expect(placeOrder('my-token', lines)).rejects.toMatchObject({
      status: 400,
      message: 'Product 1 does not exist.'
    });
  });
});
