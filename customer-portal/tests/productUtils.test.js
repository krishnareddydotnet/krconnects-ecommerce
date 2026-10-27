import { describe, it, expect } from 'vitest';
import { formatPrice } from '../src/utils/productUtils.js';

describe('formatPrice', () => {
  it('formats a number as Indian rupees', () => {
    expect(formatPrice(1599)).toBe('₹1,599.00');
  });

  it('uses the Indian number format for large amounts', () => {
    expect(formatPrice(125000)).toBe('₹1,25,000.00');
  });
});
