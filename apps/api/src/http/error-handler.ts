import type { NextFunction, Request, Response } from 'express';
import { ERROR_CODES } from '@streamsync/shared';
import { HttpError } from './http-error.js';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ code: ERROR_CODES.NOT_FOUND, message: 'No such endpoint' });
}

// Express recognises error handlers by their four-argument signature, so `next` must stay.
export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ code: err.code, message: err.message });
    return;
  }

  const type = (err as { type?: string } | null)?.type;
  if (type === 'entity.parse.failed') {
    res.status(400).json({ code: ERROR_CODES.INVALID_JSON, message: 'Request body must be valid JSON' });
    return;
  }

  if (type === 'entity.too.large') {
    res.status(413).json({ code: ERROR_CODES.PAYLOAD_TOO_LARGE, message: 'Request body is too large' });
    return;
  }

  console.error('Unhandled request error:', err);
  res.status(500).json({ code: ERROR_CODES.INTERNAL_ERROR, message: 'Something went wrong. Please try again.' });
}
