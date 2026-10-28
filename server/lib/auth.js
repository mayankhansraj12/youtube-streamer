'use strict';

const jwt = require('jsonwebtoken');

const JWT_ALGORITHM = 'HS256';

/** Creates a signed session token. The payload shape stays `{ user: { id, username } }`. */
function signSession(user, { secret, expiresIn }) {
  return jwt.sign(
    { user: { id: String(user.id), username: user.username } },
    secret,
    { algorithm: JWT_ALGORITHM, expiresIn }
  );
}

/** Returns `{ id, username }` for a valid, unexpired token, otherwise `null`. */
function verifySession(token, secret) {
  if (typeof token !== 'string' || token.length === 0) return null;

  try {
    const payload = jwt.verify(token, secret, { algorithms: [JWT_ALGORITHM] });
    const user = payload && payload.user;
    if (!user || typeof user.id !== 'string' || typeof user.username !== 'string') return null;
    return { id: user.id, username: user.username };
  } catch {
    return null;
  }
}

module.exports = { signSession, verifySession };
