const { describe, it, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const worker = require('../src/worker');

describe('health endpoints', () => {
  afterEach(() => mock.restoreAll());

  it('GET /health/live returns 200', async () => {
    const res = await request(app).get('/health/live');

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });

  it('GET /health/ready returns 503 when Service Bus is not configured', async () => {
    // Nothing started in tests, so the worker is "not-configured"
    const res = await request(app).get('/health/ready');

    assert.equal(res.status, 503);
    assert.equal(res.body.receiver, 'not-configured');
  });

  it('GET /health/ready returns 200 when the receiver is running', async () => {
    mock.method(worker, 'isReady', () => true);

    const res = await request(app).get('/health/ready');

    assert.equal(res.status, 200);
  });

  it('GET / shows which service this is', async () => {
    const res = await request(app).get('/');

    assert.equal(res.body.service, 'krconnects-notification-service');
  });
});
