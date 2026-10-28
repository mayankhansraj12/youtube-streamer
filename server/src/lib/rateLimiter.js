'use strict';

/**
 * Token-bucket limiter used per socket. `take()` returns `true` when the action
 * is allowed and consumes one token, or `false` when the caller is over budget.
 */
function createRateLimiter({ capacity, refillPerSecond, now = Date.now }) {
  let tokens = capacity;
  let updatedAt = now();

  return {
    take() {
      const current = now();
      tokens = Math.min(capacity, tokens + ((current - updatedAt) / 1000) * refillPerSecond);
      updatedAt = current;

      if (tokens < 1) return false;
      tokens -= 1;
      return true;
    },
  };
}

module.exports = { createRateLimiter };
