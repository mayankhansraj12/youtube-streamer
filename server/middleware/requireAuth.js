'use strict';

const { verifySession } = require('../lib/auth');
const { HttpError } = require('../lib/httpError');

const BEARER_PREFIX = 'Bearer ';

/** Accepts `Authorization: Bearer <token>`, with `x-auth-token` kept as a fallback. */
function createRequireAuth(secret) {
  return function requireAuth(req, res, next) {
    const header = req.get('authorization') || '';
    const token = header.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length).trim() : req.get('x-auth-token');

    const user = verifySession(token, secret);
    if (!user) {
      next(new HttpError(401, 'UNAUTHORIZED', 'Your session is missing or has expired. Please sign in again.'));
      return;
    }

    req.user = user;
    next();
  };
}

module.exports = { createRequireAuth };
