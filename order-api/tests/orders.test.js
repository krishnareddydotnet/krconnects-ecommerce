const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { makeToken, products } = require('./helpers');
const app = require('../src/app');
const dataApiClient = require('../src/services/dataApiClient');

const token = makeToken({ userId: 1, username: 'krishna' });

// The Data API saves the order and adds id + createdAt. This fake does the same.
function fakeCreateOrder(order) {
  return Promise.resolve({ id: 42, createdAt: '2026-10-31T10:00:00Z', ...order });
}

function postOrder(body) {
  return request(app).post('/orders').set('Authorization', `Bearer ${token}`).send(body);
}

describe('POST /orders', () => {
  let createOrderMock;

  beforeEach(() => {
    // Mock the Data API: no real HTTP calls in unit tests
    mock.method(dataApiClient, 'getProduct', async (id) => products[id] || null);
    createOrderMock = mock.method(dataApiClient, 'createOrder', fakeCreateOrder);
    mock.method(console, 'log', () => {});   // keep test output quiet
  });

  afterEach(() => mock.restoreAll());

  it('places an order and returns 201 with the saved order', async () => {
    const res = await postOrder({ items: [{ productId: 1, quantity: 2 }] });

    assert.equal(res.status, 201);
    assert.equal(res.body.id, 42);
    assert.equal(res.body.status, 'Placed');
    assert.equal(res.body.userId, 1);
    assert.equal(res.body.username, 'krishna');
    assert.match(res.body.orderNumber, /^KRC-\d{8}-[A-Z0-9]{6}$/);
  });

  it('takes the price from the Data API, not from the request body', async () => {
    const res = await postOrder({ items: [{ productId: 1, quantity: 1, price: 1, unitPrice: 1 }] });

    assert.equal(res.status, 201);
    assert.equal(res.body.items[0].unitPrice, 1599);
    assert.equal(res.body.items[0].productName, 'Wireless Mouse');
    assert.equal(res.body.subtotal, 1599);
  });

  it('gives free delivery above ₹999', async () => {
    const res = await postOrder({ items: [{ productId: 1, quantity: 2 }] });   // 2 x 1599

    assert.equal(res.body.subtotal, 3198);
    assert.equal(res.body.delivery, 0);
    assert.equal(res.body.total, 3198);
  });

  it('charges ₹49 delivery for ₹999 or less', async () => {
    const res = await postOrder({ items: [{ productId: 4, quantity: 1 }] });   // 499

    assert.equal(res.body.subtotal, 499);
    assert.equal(res.body.delivery, 49);
    assert.equal(res.body.total, 548);
  });

  it('adds up several lines without rounding errors', async () => {
    // 1599 + 2 x 499 + 3 x 10.10 = 2627.30
    const res = await postOrder({
      items: [
        { productId: 1, quantity: 1 },
        { productId: 4, quantity: 2 },
        { productId: 7, quantity: 3 }
      ]
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.items.length, 3);
    assert.equal(res.body.items[2].lineTotal, 30.3);
    assert.equal(res.body.subtotal, 2627.3);
    assert.equal(res.body.total, 2627.3);
  });

  it('sends the order to the Data API exactly once', async () => {
    await postOrder({ items: [{ productId: 4, quantity: 1 }] });

    assert.equal(createOrderMock.mock.callCount(), 1);
    const sent = createOrderMock.mock.calls[0].arguments[0];
    assert.equal(sent.userId, 1);
    assert.equal(sent.items[0].lineTotal, 499);
  });

  it('returns 400 for an unknown product', async () => {
    const res = await postOrder({ items: [{ productId: 999, quantity: 1 }] });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /does not exist/);
    assert.equal(createOrderMock.mock.callCount(), 0);   // nothing saved
  });

  // ----- Validation: each case must return 400 with a clear message -----
  const badBodies = [
    ['no body', undefined],
    ['items missing', {}],
    ['items not a list', { items: 'abc' }],
    ['empty items', { items: [] }],
    ['item not an object', { items: [5] }],
    ['productId missing', { items: [{ quantity: 1 }] }],
    ['productId as text', { items: [{ productId: '1', quantity: 1 }] }],
    ['quantity 0', { items: [{ productId: 1, quantity: 0 }] }],
    ['quantity 11', { items: [{ productId: 1, quantity: 11 }] }],
    ['quantity 1.5', { items: [{ productId: 1, quantity: 1.5 }] }],
    ['same product twice', { items: [{ productId: 1, quantity: 1 }, { productId: 1, quantity: 2 }] }],
    ['21 lines', { items: Array.from({ length: 21 }, (_, i) => ({ productId: i + 1, quantity: 1 })) }]
  ];

  for (const [name, body] of badBodies) {
    it(`returns 400 for ${name}`, async () => {
      const res = await postOrder(body);

      assert.equal(res.status, 400);
      assert.ok(res.body.message, 'a message explains the problem');
      assert.equal(createOrderMock.mock.callCount(), 0);
    });
  }

  it('returns 400 for broken JSON', async () => {
    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send('{ not json');

    assert.equal(res.status, 400);
  });

  it('returns 503 when the Data API is down', async () => {
    mock.method(dataApiClient, 'getProduct', async () => {
      throw new Error('connect ECONNREFUSED');
    });
    mock.method(console, 'error', () => {});

    const res = await postOrder({ items: [{ productId: 1, quantity: 1 }] });

    assert.equal(res.status, 503);
  });
});

describe('GET /orders/my and GET /orders/:id', () => {
  const myOrder = { id: 10, orderNumber: 'KRC-20261031-AAAAAA', userId: 1, username: 'krishna', items: [] };
  const otherUsersOrder = { id: 11, orderNumber: 'KRC-20261031-BBBBBB', userId: 2, username: 'someone', items: [] };

  afterEach(() => mock.restoreAll());

  it('GET /orders/my returns the orders of the logged-in user', async () => {
    const getOrdersMock = mock.method(dataApiClient, 'getOrdersByUser', async () => [myOrder]);

    const res = await request(app).get('/orders/my').set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].orderNumber, 'KRC-20261031-AAAAAA');
    // the user id comes from the token, not from the URL or body
    assert.equal(getOrdersMock.mock.calls[0].arguments[0], 1);
  });

  it('GET /orders/:id returns my own order', async () => {
    mock.method(dataApiClient, 'getOrderById', async () => myOrder);

    const res = await request(app).get('/orders/10').set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.id, 10);
  });

  it('GET /orders/:id of another user returns 404', async () => {
    mock.method(dataApiClient, 'getOrderById', async () => otherUsersOrder);

    const res = await request(app).get('/orders/11').set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 404);
  });

  it('GET /orders/:id that does not exist returns 404', async () => {
    mock.method(dataApiClient, 'getOrderById', async () => null);

    const res = await request(app).get('/orders/999').set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 404);
  });

  it('GET /orders/:id with a non-numeric id returns 400', async () => {
    const res = await request(app).get('/orders/abc').set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 400);
  });
});
