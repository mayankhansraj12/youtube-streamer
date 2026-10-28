'use strict';

/**
 * An error that carries an HTTP status and a stable, machine-readable code.
 * The Express error handler turns it into `{ code, message }` JSON.
 */
class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

module.exports = { HttpError };
