const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');

// config.js reads the env once when loaded, so load a fresh copy per test
function loadConfig() {
  delete require.cache[require.resolve('../src/config')];
  return require('../src/config');
}

describe('config', () => {
  afterEach(() => {
    delete process.env.MAX_CONCURRENT_CALLS;
  });

  it('has sensible defaults', () => {
    const config = loadConfig();

    assert.equal(config.port, 8083);
    assert.equal(config.topic, 'orders');
    assert.equal(config.subscription, 'notification-service');
    assert.equal(config.maxConcurrentCalls, 5);
  });

  it('reads MAX_CONCURRENT_CALLS, and ignores bad values', () => {
    process.env.MAX_CONCURRENT_CALLS = '10';
    assert.equal(loadConfig().maxConcurrentCalls, 10);

    process.env.MAX_CONCURRENT_CALLS = 'abc';
    assert.equal(loadConfig().maxConcurrentCalls, 5);

    process.env.MAX_CONCURRENT_CALLS = '0';
    assert.equal(loadConfig().maxConcurrentCalls, 5);
  });
});
