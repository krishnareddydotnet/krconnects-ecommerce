const { describe, it, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
require('./helpers');
const app = require('../src/app');
const dataApiClient = require('../src/services/dataApiClient');

describe('health endpoints', () => {
  afterEach(() => mock.restoreAll());

  it('GET /health/live returns 200 without a token', async () => {
    const res = await request(app).get('/health/live');

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });

  it('GET /health/ready returns 200 when the Data API is reachable', async () => {
    mock.method(dataApiClient, 'isReachable', async () => true);

    const res = await request(app).get('/health/ready');

    assert.equal(res.status, 200);
    assert.equal(res.body.check, 'ready');
  });

  it('GET /health/ready returns 503 when the Data API is down', async () => {
    mock.method(dataApiClient, 'isReachable', async () => false);

    const res = await request(app).get('/health/ready');

    assert.equal(res.status, 503);
  });

  it('GET / shows which service this is', async () => {
    const res = await request(app).get('/');

    assert.equal(res.status, 200);
    assert.equal(res.body.service, 'krconnects-order-api');
  });
});
