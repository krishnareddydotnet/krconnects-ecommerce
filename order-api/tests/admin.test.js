const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { makeToken } = require('./helpers');
const app = require('../src/app');
const dataApiClient = require('../src/services/dataApiClient');

const adminToken = makeToken({ userId: 9, username: 'boss', role: 'admin' });
const customerToken = makeToken({ userId: 1, username: 'krishna', role: 'customer' });
const tokenWithoutRole = makeToken({ role: undefined });   // like tokens from before roles existed

const onePage = {
  items: [{ id: 2, orderNumber: 'KRC-20261031-BBBBBB', status: 'Placed', items: [] }],
  page: 1,
  pageSize: 20,
  totalCount: 1,
  totalPages: 1
};

describe('admin order endpoints', () => {
  let getPageMock;
  let updateStatusMock;

  beforeEach(() => {
    getPageMock = mock.method(dataApiClient, 'getOrdersPage', async () => onePage);
    updateStatusMock = mock.method(dataApiClient, 'updateOrderStatus', async (id, status) => {
      if (id === 999) return null;
      return { id: id, orderNumber: 'KRC-20261031-BBBBBB', status: status, items: [] };
    });
    mock.method(console, 'log', () => {});
    mock.method(console, 'error', () => {});
  });

  afterEach(() => mock.restoreAll());

  // ----- 401 / 403 -----

  it('GET /admin/orders without a token returns 401', async () => {
    const res = await request(app).get('/admin/orders');

    assert.equal(res.status, 401);
    assert.equal(getPageMock.mock.callCount(), 0);
  });

  it('GET /admin/orders with a bad token returns 401', async () => {
    const res = await request(app).get('/admin/orders').set('Authorization', 'Bearer not-a-jwt');

    assert.equal(res.status, 401);
  });

  it('GET /admin/orders as a customer returns 403', async () => {
    const res = await request(app).get('/admin/orders').set('Authorization', `Bearer ${customerToken}`);

    assert.equal(res.status, 403);
    assert.equal(getPageMock.mock.callCount(), 0);
  });

  it('a token without a role claim is treated as customer (403)', async () => {
    const res = await request(app).get('/admin/orders').set('Authorization', `Bearer ${tokenWithoutRole}`);

    assert.equal(res.status, 403);
  });

  it('PATCH status as a customer returns 403 and changes nothing', async () => {
    const res = await request(app)
      .patch('/admin/orders/2/status')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ status: 'Shipped' });

    assert.equal(res.status, 403);
    assert.equal(updateStatusMock.mock.callCount(), 0);
  });

  // ----- Success -----

  it('GET /admin/orders as admin returns the page (defaults page 1, size 20)', async () => {
    const res = await request(app).get('/admin/orders').set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.totalCount, 1);
    assert.equal(res.body.items[0].orderNumber, 'KRC-20261031-BBBBBB');
    assert.deepEqual(getPageMock.mock.calls[0].arguments, [1, 20]);
  });

  it('GET /admin/orders passes page and pageSize on', async () => {
    await request(app).get('/admin/orders?page=3&pageSize=50').set('Authorization', `Bearer ${adminToken}`);

    assert.deepEqual(getPageMock.mock.calls[0].arguments, [3, 50]);
  });

  it('PATCH status as admin returns the updated order', async () => {
    const res = await request(app)
      .patch('/admin/orders/2/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Shipped' });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'Shipped');
    assert.deepEqual(updateStatusMock.mock.calls[0].arguments, [2, 'Shipped']);
  });

  it('PATCH status of an unknown order returns 404', async () => {
    const res = await request(app)
      .patch('/admin/orders/999/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Delivered' });

    assert.equal(res.status, 404);
  });

  it('returns 503 when the Data API is down', async () => {
    getPageMock.mock.mockImplementation(async () => {
      throw new Error('connect ECONNREFUSED');
    });

    const res = await request(app).get('/admin/orders').set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 503);
  });

  // ----- Validation (400) -----

  const badQueries = ['page=0', 'page=abc', 'pageSize=0', 'pageSize=101', 'pageSize=2.5'];
  for (const query of badQueries) {
    it(`GET /admin/orders?${query} returns 400`, async () => {
      const res = await request(app).get(`/admin/orders?${query}`).set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 400);
      assert.ok(res.body.message);
    });
  }

  const badBodies = [
    ['missing status', {}],
    ['unknown status', { status: 'Lost' }],
    ['wrong case', { status: 'shipped' }],
    ['status as a number', { status: 1 }]
  ];
  for (const [name, body] of badBodies) {
    it(`PATCH status with ${name} returns 400`, async () => {
      const res = await request(app)
        .patch('/admin/orders/2/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body);

      assert.equal(res.status, 400);
      assert.match(res.body.message, /Placed, Shipped, Delivered, Cancelled/);
      assert.equal(updateStatusMock.mock.callCount(), 0);
    });
  }

  it('PATCH status with a non-numeric id returns 400', async () => {
    const res = await request(app)
      .patch('/admin/orders/abc/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Shipped' });

    assert.equal(res.status, 400);
  });
});
