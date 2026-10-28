'use strict';

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { signSession } = require('../lib/auth');
const { HttpError } = require('../lib/httpError');
const { normalizeUsername, normalizeEmail, validatePassword } = require('../lib/validation');
const { createRequireAuth } = require('../middleware/requireAuth');

const RATE_WINDOW_MS = 15 * 60 * 1000;

// Used to keep failed logins for unknown accounts as slow as real ones.
let dummyHashPromise = null;
const getDummyHash = () => {
  dummyHashPromise = dummyHashPromise || bcrypt.hash('streamsync-timing-filler', 12);
  return dummyHashPromise;
};

const trimmedText = (value) => (typeof value === 'string' ? value.trim() : '');

function duplicateKeyError(err) {
  if (err.code !== 11000) return err;
  const field = Object.keys(err.keyPattern || {})[0];
  return field === 'email'
    ? new HttpError(409, 'EMAIL_TAKEN', 'An account with that email already exists')
    : new HttpError(409, 'USERNAME_TAKEN', 'That username is already taken');
}

function createAuthRouter({ config }) {
  const router = express.Router();
  const requireAuth = createRequireAuth(config.jwtSecret);

  const authLimiter = rateLimit({
    windowMs: RATE_WINDOW_MS,
    limit: config.authRateLimit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({ code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a few minutes and try again.' });
    },
  });

  const sessionFor = (user) => ({
    token: signSession(user, { secret: config.jwtSecret, expiresIn: config.jwtExpiresIn }),
    user: user.toPublicJSON(),
  });

  // @route   POST /api/auth/signup
  router.post('/signup', authLimiter, async (req, res) => {
    const username = normalizeUsername(req.body && req.body.username);
    const email = normalizeEmail(req.body && req.body.email);
    const password = validatePassword(req.body && req.body.password);

    if (await User.exists({ username })) {
      throw new HttpError(409, 'USERNAME_TAKEN', 'That username is already taken');
    }
    if (email && (await User.exists({ email }))) {
      throw new HttpError(409, 'EMAIL_TAKEN', 'An account with that email already exists');
    }

    let user;
    try {
      user = await User.create({ username, email, password });
    } catch (err) {
      throw duplicateKeyError(err);
    }

    res.status(201).json(sessionFor(user));
  });

  // @route   POST /api/auth/login  (identifier = username or email)
  router.post('/login', authLimiter, async (req, res) => {
    const identifier = trimmedText(req.body && (req.body.identifier ?? req.body.email));
    const password = typeof (req.body && req.body.password) === 'string' ? req.body.password : '';
    if (!identifier || !password) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Enter your username or email and your password');
    }

    const user = await User.findOne({
      $or: [{ email: identifier.toLowerCase() }, { username: identifier }],
    }).select('+password');

    const passwordMatches = user
      ? await user.matchPassword(password)
      : await bcrypt.compare(password, await getDummyHash());

    if (!user || !passwordMatches) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Incorrect username/email or password');
    }

    res.json(sessionFor(user));
  });

  // @route   GET /api/auth/me
  router.get('/me', requireAuth, async (req, res) => {
    const user = mongoose.isValidObjectId(req.user.id) ? await User.findById(req.user.id) : null;
    if (!user) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Your account no longer exists. Please sign in again.');
    }

    res.json({ user: user.toPublicJSON() });
  });

  return router;
}

module.exports = { createAuthRouter };
