const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const request = require('supertest');
const { TEST_KEY, makeToken } = require('./helpers');
const app = require('../src/app');

describe('login check (JWT)', () => {
  afterEach(() => {
    process.env.Jwt__Key = TEST_KEY;   // some tests remove the key
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/orders/my');

    assert.equal(res.status, 401);
  });

  it('returns 401 for a header that is not "Bearer <token>"', async () => {
    const res = await request(app).get('/orders/my').set('Authorization', 'Basic abc');

    assert.equal(res.status, 401);
  });

  it('returns 401 for a garbage token', async () => {
    const res = await request(app).get('/orders/my').set('Authorization', 'Bearer not-a-jwt');

    assert.equal(res.status, 401);
  });

  it('returns 401 for a token signed with another key', async () => {
    const otherKey = crypto.randomBytes(32).toString('hex');
    const token = makeToken({ key: otherKey });

    const res = await request(app).get('/orders/my').set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 401);
  });

  it('returns 401 for the wrong issuer', async () => {
    const token = makeToken({ issuer: 'someone-else' });

    const res = await request(app).get('/orders/my').set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 401);
  });

  it('returns 401 for the wrong audience', async () => {
    const token = makeToken({ audience: 'another-app' });

    const res = await request(app).get('/orders/my').set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 401);
  });

  it('returns 401 for an expired token', async () => {
    const token = makeToken({ expiresIn: '-10m' });   // expired 10 minutes ago

    const res = await request(app).get('/orders/my').set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 401);
  });

  it('returns 401 for a token signed with another algorithm (HS512)', async () => {
    const token = makeToken({ algorithm: 'HS512' });

    const res = await request(app).get('/orders/my').set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 401);
  });

  it('returns 401 for every request when Jwt__Key is not set', async () => {
    const token = makeToken();
    delete process.env.Jwt__Key;

    const res = await request(app).get('/orders/my').set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 401);
  });
});
