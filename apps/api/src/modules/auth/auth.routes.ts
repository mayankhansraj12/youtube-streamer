import bcrypt from 'bcryptjs';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import mongoose from 'mongoose';
import { ERROR_CODES, type AuthSession, type CurrentUserResponse } from '@streamsync/shared';
import type { Config } from '../../config.js';
import { HttpError } from '../../http/http-error.js';
import { createRequireAuth, currentUser } from '../../http/require-auth.js';
import { signSession } from '../../lib/session-token.js';
import { normalizeEmail, normalizeUsername, validatePassword } from '../../lib/validation.js';
import { User, type UserDocument } from './user.model.js';

const RATE_WINDOW_MS = 15 * 60 * 1000;
const DUPLICATE_KEY_ERROR = 11000;

// Used to keep failed logins for unknown accounts as slow as real ones.
let dummyHashPromise: Promise<string> | null = null;
const getDummyHash = (): Promise<string> => {
  dummyHashPromise = dummyHashPromise || bcrypt.hash('streamsync-timing-filler', 12);
  return dummyHashPromise;
};

const trimmedText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

function duplicateKeyError(err: unknown): unknown {
  const { code, keyPattern } = err as { code?: number; keyPattern?: Record<string, unknown> };
  if (code !== DUPLICATE_KEY_ERROR) return err;
  const field = Object.keys(keyPattern || {})[0];
  return field === 'email'
    ? new HttpError(409, ERROR_CODES.EMAIL_TAKEN, 'An account with that email already exists')
    : new HttpError(409, ERROR_CODES.USERNAME_TAKEN, 'That username is already taken');
}

export function createAuthRouter({ config }: { config: Config }) {
  const router = express.Router();
  const requireAuth = createRequireAuth(config.jwtSecret);

  const authLimiter = rateLimit({
    windowMs: RATE_WINDOW_MS,
    limit: config.authRateLimit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      res
        .status(429)
        .json({ code: ERROR_CODES.RATE_LIMITED, message: 'Too many attempts. Please wait a few minutes and try again.' });
    },
  });

  const sessionFor = (user: UserDocument): AuthSession => ({
    token: signSession({ id: user.id, username: user.username }, {
      secret: config.jwtSecret,
      expiresIn: config.jwtExpiresIn,
    }),
    user: user.toPublicJSON(),
  });

  // @route   POST /api/auth/signup
  router.post('/signup', authLimiter, async (req, res) => {
    const body: Record<string, unknown> = req.body ?? {};
    const username = normalizeUsername(body.username);
    const email = normalizeEmail(body.email);
    const password = validatePassword(body.password);

    if (await User.exists({ username })) {
      throw new HttpError(409, ERROR_CODES.USERNAME_TAKEN, 'That username is already taken');
    }
    if (email && (await User.exists({ email }))) {
      throw new HttpError(409, ERROR_CODES.EMAIL_TAKEN, 'An account with that email already exists');
    }

    let user: UserDocument;
    try {
      user = await User.create({ username, email, password });
    } catch (err) {
      throw duplicateKeyError(err);
    }

    res.status(201).json(sessionFor(user));
  });

  // @route   POST /api/auth/login  (identifier = username or email)
  router.post('/login', authLimiter, async (req, res) => {
    const body: Record<string, unknown> = req.body ?? {};
    const identifier = trimmedText(body.identifier ?? body.email);
    const password = typeof body.password === 'string' ? body.password : '';
    if (!identifier || !password) {
      throw new HttpError(400, ERROR_CODES.VALIDATION_ERROR, 'Enter your username or email and your password');
    }

    const user = await User.findOne({
      $or: [{ email: identifier.toLowerCase() }, { username: identifier }],
    }).select('+password');

    const passwordMatches = user
      ? await user.matchPassword(password)
      : await bcrypt.compare(password, await getDummyHash());

    if (!user || !passwordMatches) {
      throw new HttpError(401, ERROR_CODES.INVALID_CREDENTIALS, 'Incorrect username/email or password');
    }

    res.json(sessionFor(user));
  });

  // @route   GET /api/auth/me
  router.get('/me', requireAuth, async (req, res) => {
    const userId = currentUser(req).id;
    const user = mongoose.isValidObjectId(userId) ? await User.findById(userId) : null;
    if (!user) {
      throw new HttpError(401, ERROR_CODES.UNAUTHORIZED, 'Your account no longer exists. Please sign in again.');
    }

    const body: CurrentUserResponse = { user: user.toPublicJSON() };
    res.json(body);
  });

  return router;
}
