// -----------------------------------------------------------------------
// KRConnects Order API - starts the web server.
// The Express app itself lives in app.js, so tests can use it without
// opening a real port.
// -----------------------------------------------------------------------

const app = require('./app');

const port = Number(process.env.PORT) || 8082;

// Warn (but keep running) when the JWT key is missing: every order request
// will get 401 until the key is configured. We never print the key itself.
if (!process.env.Jwt__Key) {
  console.warn('WARNING: Jwt__Key is not set. All order requests will be rejected with 401.');
}

app.listen(port, () => {
  console.log(`krconnects-order-api listening on port ${port}`);
});
