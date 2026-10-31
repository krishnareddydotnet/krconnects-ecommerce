const { describe, it, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { sendOrderConfirmation } = require('../src/notifier');

describe('notifier', () => {
  afterEach(() => mock.restoreAll());

  it('writes a clear confirmation line', async () => {
    mock.method(console, 'log', () => {});

    await sendOrderConfirmation({ username: 'krishna', orderNumber: 'KRC-20261031-ABC123', total: 2597, itemCount: 3 });

    assert.equal(
      console.log.mock.calls[0].arguments[0],
      'Order confirmation for krishna: order KRC-20261031-ABC123, total ₹2597.00, 3 item(s)'
    );
  });
});
