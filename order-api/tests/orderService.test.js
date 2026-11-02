const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { calculateDelivery, generateOrderNumber, validateItems } = require('../src/services/orderService');

describe('orderService rules', () => {
  it('delivery: same rule as the customer portal', () => {
    assert.equal(calculateDelivery(0), 0);       // empty cart
    assert.equal(calculateDelivery(499), 49);
    assert.equal(calculateDelivery(999), 49);    // exactly ₹999 still pays delivery
    assert.equal(calculateDelivery(999.01), 0);  // above ₹999 is free
    assert.equal(calculateDelivery(5000), 0);
  });

  it('order number: KRC-<YYYYMMDD>-<6 letters/digits>', () => {
    const orderNumber = generateOrderNumber(new Date(Date.UTC(2026, 9, 31)));

    assert.match(orderNumber, /^KRC-20261031-[A-Z0-9]{6}$/);
  });

  it('order numbers are random', () => {
    const first = generateOrderNumber();
    const second = generateOrderNumber();

    assert.notEqual(first, second);
  });

  it('valid items have no problem', () => {
    assert.equal(validateItems([{ productId: 1, quantity: 10 }]), null);
  });
});
