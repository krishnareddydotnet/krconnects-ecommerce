// -----------------------------------------------------------------------
// Login check: validates the JWT that auth-api created.
//
// The browser sends:  Authorization: Bearer <token>
// We check the SAME rules as auth-api (see auth-api/src/Program.cs):
//   - signed with HS256 using the shared secret Jwt__Key
//   - issuer   = krconnects-auth-api
//   - audience = krconnects-customer-portal
//   - not expired (1 minute clock skew allowed, like auth-api)
// The token's "sub" claim is the user id, "name" is the username.
//
// The token is never logged.
// -----------------------------------------------------------------------

const jwt = require('jsonwebtoken');

// Same 1 minute tolerance as auth-api's ClockSkew, so both services agree
// on when a token has expired.
const CLOCK_TOLERANCE_SECONDS = 60;

function unauthorized(res) {
  return res.status(401).json({ message: 'Please log in to continue.' });
}

function requireLogin(req, res, next) {
  // Read settings on every request (cheap), so tests and restarts see changes.
  const key = process.env.Jwt__Key;
  const issuer = process.env.JWT_ISSUER || 'krconnects-auth-api';
  const audience = process.env.JWT_AUDIENCE || 'krconnects-customer-portal';

  // No key configured -> we can't check any token -> reject (app keeps running)
  if (!key) {
    return unauthorized(res);
  }

  // Expect "Bearer <token>"
  const header = req.headers.authorization || '';
  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer' || parts[1] === '') {
    return unauthorized(res);
  }
  const token = parts[1];

  let claims;
  try {
    claims = jwt.verify(token, key, {
      algorithms: ['HS256'],   // only HS256: blocks "alg: none" and algorithm-swap tricks
      issuer: issuer,
      audience: audience,
      clockTolerance: CLOCK_TOLERANCE_SECONDS
    });
  } catch {
    // Wrong signature, wrong issuer/audience, expired, broken token...
    // We don't say which one: that would help an attacker.
    return unauthorized(res);
  }

  // "sub" must be the numeric user id that auth-api puts in the token
  const userId = Number(claims.sub);
  if (!Number.isInteger(userId) || userId <= 0 || typeof claims.name !== 'string') {
    return unauthorized(res);
  }

  // Make the logged-in user available to the route handlers
  req.user = { id: userId, username: claims.name };
  next();
}

module.exports = { requireLogin };
