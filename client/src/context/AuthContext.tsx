import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi, isUnauthorizedError, setAuthToken, setUnauthorizedHandler } from '../lib/api';
import { disposeSocket } from '../lib/socket';
import { AuthContext, type AuthContextValue } from './authState';
import type { AuthUser } from '../types';

const TOKEN_KEY = 'streamsync.token';
const USER_KEY = 'streamsync.user';

interface Session {
  token: string;
  user: AuthUser | null;
}

function readStoredSession(): Session | null {
  try {
    const token = window.localStorage.getItem(TOKEN_KEY);
    if (!token) return null;

    const storedUser = window.localStorage.getItem(USER_KEY);
    return { token, user: storedUser ? (JSON.parse(storedUser) as AuthUser) : null };
  } catch {
    return null;
  }
}

function writeStoredSession(session: Session | null): void {
  try {
    if (session) {
      window.localStorage.setItem(TOKEN_KEY, session.token);
      if (session.user) window.localStorage.setItem(USER_KEY, JSON.stringify(session.user));
    } else {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(USER_KEY);
    }
  } catch {
    // Storage is unavailable (private mode, for example). The session lasts until reload.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initialSession] = useState<Session | null>(readStoredSession);
  const [session, setSession] = useState<Session | null>(initialSession);
  const [loading, setLoading] = useState(initialSession !== null);

  const logout = useCallback(() => {
    writeStoredSession(null);
    setAuthToken(null);
    disposeSocket();
    setSession(null);
  }, []);

  const login = useCallback(({ token, user }: { token: string; user: AuthUser }) => {
    writeStoredSession({ token, user });
    setAuthToken(token);
    setSession({ token, user });
  }, []);

  useEffect(() => {
    setAuthToken(session?.token ?? null);
  }, [session?.token]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  // Confirm a stored session once on startup. Only an explicit 401 ends it. A network failure
  // keeps the cached user, so reloading while the API is briefly unreachable still works.
  useEffect(() => {
    if (!initialSession) return;

    let cancelled = false;
    setAuthToken(initialSession.token);
    authApi
      .me()
      .then((user) => {
        if (cancelled) return;
        writeStoredSession({ token: initialSession.token, user });
        setSession({ token: initialSession.token, user });
      })
      .catch((error: unknown) => {
        if (!cancelled && isUnauthorizedError(error)) logout();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialSession, logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      isAuthenticated: session !== null,
      loading,
      login,
      logout,
    }),
    [session, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

