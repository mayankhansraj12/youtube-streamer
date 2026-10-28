import type { NextFunction, Request, Response } from 'express';
import { ERROR_CODES } from '@streamsync/shared';
import { verifySession, type SessionUser } from '../lib/session-token.js';
import { HttpError } from './http-error.js';

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

const BEARER_PREFIX = 'Bearer ';

/** Accepts `Authorization: Bearer <token>`, with `x-auth-token` kept as a fallback. */
export function createRequireAuth(secret: string) {
  return function requireAuth(req: Request, _res: Response, next: NextFunction): void {
    const header = req.get('authorization') || '';
    const token = header.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length).trim() : req.get('x-auth-token');

    const user = verifySession(token, secret);
    if (!user) {
      next(new HttpError(401, ERROR_CODES.UNAUTHORIZED, 'Your session is missing or has expired. Please sign in again.'));
      return;
    }

    req.user = user;
    next();
  };
}
