import { describe, it, expect } from 'vitest';
import { getCartLines, getCartSummary, toCartProduct } from '../src/utils/cartUtils.js';

const mouse = { id: 1, name: 'Wireless Mouse', category: 'Electronics', price: 1599, imageUrl: null };
const book = { id: 2, name: 'Clean Code', category: 'Books', price: 499, imageUrl: null };

describe('cartUtils', () => {
  it('builds cart lines with line totals', () => {
    const lines = getCartLines({ 1: { product: mouse, quantity: 2 } });
    expect(lines[0].lineTotal).toBe(3198);
  });

  it('free delivery above ₹999', () => {
    const summary = getCartSummary(getCartLines({ 1: { product: mouse, quantity: 1 } }));
    expect(summary).toEqual({ itemCount: 1, subtotal: 1599, delivery: 0, total: 1599 });
  });

  it('₹49 delivery for orders of ₹999 or less', () => {
    const summary = getCartSummary(getCartLines({ 2: { product: book, quantity: 1 } }));
    expect(summary).toEqual({ itemCount: 1, subtotal: 499, delivery: 49, total: 548 });
  });

  it('keeps only the product fields the cart needs', () => {
    expect(toCartProduct({ ...mouse, extra: 'x' })).toEqual(mouse);
  });
});
