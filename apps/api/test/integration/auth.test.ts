import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { ApiErrorBody, AuthSession, CurrentUserResponse, HealthResponse } from '@streamsync/shared';
import { startTestServer, type TestServer } from '../helpers/testServer.js';
import { PASSWORD, uniqueUsername, api, createAccount } from '../helpers/client.js';
import { User } from '../../src/modules/auth/user.model.js';

/** The contract has no password field. Declaring it optional lets the test assert that it is absent. */
type MeResponse = CurrentUserResponse & { user: { password?: string } };

describe('auth API', () => {
  let server: TestServer;

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    await server.stop();
  });

  it('creates accounts without an email and returns a session', async () => {
    const username = uniqueUsername('noemail');
    const res = await api<AuthSession>(server.baseUrl, 'POST', '/api/auth/signup', {
      body: { username, password: PASSWORD },
    });

    assert.equal(res.status, 201);
    assert.equal(typeof res.body.token, 'string');
    assert.equal(res.body.user.username, username);
    assert.equal(res.body.user.email, null);
  });

  it('rejects duplicate usernames and emails with stable error codes', async () => {
    const account = await createAccount(server.baseUrl, 'dup');

    const sameName = await api<ApiErrorBody>(server.baseUrl, 'POST', '/api/auth/signup', {
      body: { username: account.username, password: PASSWORD },
    });
    assert.equal(sameName.status, 409);
    assert.equal(sameName.body.code, 'USERNAME_TAKEN');

    const sameEmail = await api<ApiErrorBody>(server.baseUrl, 'POST', '/api/auth/signup', {
      body: { username: uniqueUsername('other'), email: `${account.username}@example.com`, password: PASSWORD },
    });
    assert.equal(sameEmail.status, 409);
    assert.equal(sameEmail.body.code, 'EMAIL_TAKEN');
  });

  it('validates input and rejects weak passwords and malformed JSON', async () => {
    const weak = await api<ApiErrorBody>(server.baseUrl, 'POST', '/api/auth/signup', {
      body: { username: uniqueUsername('weak'), password: 'short' },
    });
    assert.equal(weak.status, 400);
    assert.equal(weak.body.code, 'VALIDATION_ERROR');

    const badName = await api(server.baseUrl, 'POST', '/api/auth/signup', {
      body: { username: 'has spaces', password: PASSWORD },
    });
    assert.equal(badName.status, 400);

    const malformed = await api<ApiErrorBody>(server.baseUrl, 'POST', '/api/auth/signup', {
      rawBody: '{"username":',
    });
    assert.equal(malformed.status, 400);
    assert.equal(malformed.body.code, 'INVALID_JSON');
  });

  it('signs in by username or email and rejects wrong credentials', async () => {
    const account = await createAccount(server.baseUrl, 'login');

    const byUsername = await api(server.baseUrl, 'POST', '/api/auth/login', {
      body: { identifier: account.username, password: PASSWORD },
    });
    assert.equal(byUsername.status, 200);

    const byEmail = await api(server.baseUrl, 'POST', '/api/auth/login', {
      body: { identifier: `${account.username.toUpperCase()}@EXAMPLE.com`, password: PASSWORD },
    });
    assert.equal(byEmail.status, 200);

    const wrongPassword = await api<ApiErrorBody>(server.baseUrl, 'POST', '/api/auth/login', {
      body: { identifier: account.username, password: 'not-the-password' },
    });
    assert.equal(wrongPassword.status, 401);
    assert.equal(wrongPassword.body.code, 'INVALID_CREDENTIALS');

    const unknown = await api<ApiErrorBody>(server.baseUrl, 'POST', '/api/auth/login', {
      body: { identifier: uniqueUsername('ghost'), password: PASSWORD },
    });
    assert.equal(unknown.status, 401);
    assert.equal(unknown.body.code, 'INVALID_CREDENTIALS');
  });

  it('stores passwords hashed and keeps accounts usable after unrelated saves', async () => {
    const account = await createAccount(server.baseUrl, 'hash');

    // createAccount has just saved this user, so the lookup always finds it.
    const stored = (await User.findById(account.id).select('+password'))!;
    assert.match(stored.password, /^\$2[aby]\$/);
    assert.notEqual(stored.password, PASSWORD);

    stored.email = `${account.username}-updated@example.com`;
    await stored.save();

    const afterSave = await api(server.baseUrl, 'POST', '/api/auth/login', {
      body: { identifier: account.username, password: PASSWORD },
    });
    assert.equal(afterSave.status, 200, 'password must not be re-hashed by an unrelated save');
  });

  it('protects /me with the session token and never exposes the password', async () => {
    const account = await createAccount(server.baseUrl, 'me');

    const me = await api<MeResponse>(server.baseUrl, 'GET', '/api/auth/me', { token: account.token });
    assert.equal(me.status, 200);
    assert.equal(me.body.user.username, account.username);
    assert.equal(me.body.user.password, undefined);

    const anonymous = await api<ApiErrorBody>(server.baseUrl, 'GET', '/api/auth/me');
    assert.equal(anonymous.status, 401);
    assert.equal(anonymous.body.code, 'UNAUTHORIZED');

    const forged = await api(server.baseUrl, 'GET', '/api/auth/me', { token: 'eyJhbGciOiJIUzI1NiJ9.e30.abc' });
    assert.equal(forged.status, 401);
  });

  it('answers health checks with database status', async () => {
    const res = await api<HealthResponse>(server.baseUrl, 'GET', '/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.database, 'connected');
  });
});
