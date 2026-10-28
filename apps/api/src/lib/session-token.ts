import jwt, { type SignOptions } from 'jsonwebtoken';

const JWT_ALGORITHM = 'HS256';

export interface SessionUser {
  id: string;
  username: string;
}

export interface SessionOptions {
  secret: string;
  expiresIn: string | number;
}

/** Creates a signed session token. The payload shape stays `{ user: { id, username } }`. */
export function signSession(user: SessionUser, { secret, expiresIn }: SessionOptions): string {
  return jwt.sign({ user: { id: String(user.id), username: user.username } }, secret, {
    algorithm: JWT_ALGORITHM,
    expiresIn: expiresIn as SignOptions['expiresIn'],
  });
}

/** Returns `{ id, username }` for a valid, unexpired token, otherwise `null`. */
export function verifySession(token: string | undefined, secret: string): SessionUser | null {
  if (typeof token !== 'string' || token.length === 0) return null;

  try {
    const payload = jwt.verify(token, secret, { algorithms: [JWT_ALGORITHM] });
    if (typeof payload !== 'object') return null;

    const user = (payload as { user?: Partial<SessionUser> }).user;
    if (!user || typeof user.id !== 'string' || typeof user.username !== 'string') return null;
    return { id: user.id, username: user.username };
  } catch {
    return null;
  }
}
