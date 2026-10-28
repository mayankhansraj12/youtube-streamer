'use strict';

/**
 * Allows browser requests from the configured origins. Requests without an
 * Origin header (curl, health probes, server-to-server calls) are not CORS
 * requests, so they are always accepted.
 */
function isOriginAllowed(origin, allowedOrigins) {
  return !origin || allowedOrigins.includes(origin);
}

function createCorsOriginCheck(allowedOrigins) {
  return (origin, callback) => callback(null, isOriginAllowed(origin, allowedOrigins));
}

module.exports = { isOriginAllowed, createCorsOriginCheck };
