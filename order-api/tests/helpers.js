// -----------------------------------------------------------------------
// Test helpers: a random signing key and tokens shaped like auth-api's.
// The key is random for every test run, so no secret is stored in Git.
// -----------------------------------------------------------------------

const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

const TEST_KEY = crypto.randomBytes(32).toString('hex');

// Set the env var BEFORE the tests send requests (auth.js reads it per request)
process.env.Jwt__Key = TEST_KEY;

// A token like the one auth-api creates after login.
// "overrides" lets a test break one rule (wrong issuer, expired, ...).
function makeToken(overrides = {}) {
  const settings = {
    userId: 1,
    username: 'krishna',
    key: TEST_KEY,
    issuer: 'krconnects-auth-api',
    audience: 'krconnects-customer-portal',
    expiresIn: '60m',
    algorithm: 'HS256',
    role: 'customer',
    ...overrides
  };

  return jwt.sign(
    { sub: String(settings.userId), name: settings.username, role: settings.role },
    settings.key,
    {
      issuer: settings.issuer,
      audience: settings.audience,
      expiresIn: settings.expiresIn,
      algorithm: settings.algorithm
    }
  );
}

// Fake products, like the Data API returns them
const products = {
  1: { id: 1, name: 'Wireless Mouse', category: 'Electronics', price: 1599, imageUrl: null },
  4: { id: 4, name: 'Clean Code', category: 'Books', price: 499, imageUrl: null },
  7: { id: 7, name: 'Pen', category: 'Office', price: 10.1, imageUrl: null }
};

module.exports = { TEST_KEY, makeToken, products };
