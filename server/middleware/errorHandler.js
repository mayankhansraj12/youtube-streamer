'use strict';

const { HttpError } = require('../lib/httpError');

function notFoundHandler(req, res) {
  res.status(404).json({ code: 'NOT_FOUND', message: 'No such endpoint' });
}

// Express recognises error handlers by their four-argument signature, so `next` must stay.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ code: err.code, message: err.message });
    return;
  }

  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ code: 'INVALID_JSON', message: 'Request body must be valid JSON' });
    return;
  }

  if (err.type === 'entity.too.large') {
    res.status(413).json({ code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' });
    return;
  }

  console.error('Unhandled request error:', err);
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' });
}

module.exports = { notFoundHandler, errorHandler };
