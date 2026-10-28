import type { NextFunction, Request, Response } from 'express';
import { ERROR_CODES } from '@streamsync/shared';
import { verifySession, type SessionUser } from '../lib/session-token.js';
import { HttpError } from './http-error.js';

declare global {
  // Express declares Request inside this global namespace, so the augmentation has to use it too.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

const BEARER_PREFIX = 'Bearer ';
const SESSION_EXPIRED_MESSAGE = 'Your session is missing or has expired. Please sign in again.';

/** Accepts `Authorization: Bearer <token>`, with `x-auth-token` kept as a fallback. */
export function createRequireAuth(secret: string) {
  return function requireAuth(req: Request, _res: Response, next: NextFunction): void {
    const header = req.get('authorization') || '';
    const token = header.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length).trim() : req.get('x-auth-token');

    const user = verifySession(token, secret);
    if (!user) {
      next(new HttpError(401, ERROR_CODES.UNAUTHORIZED, SESSION_EXPIRED_MESSAGE));
      return;
    }

    req.user = user;
    next();
  };
}

/** The user that `requireAuth` verified for this request. Routes behind `requireAuth` always have one. */
export function currentUser(req: Request): SessionUser {
  if (!req.user) throw new HttpError(401, ERROR_CODES.UNAUTHORIZED, SESSION_EXPIRED_MESSAGE);
  return req.user;
}
