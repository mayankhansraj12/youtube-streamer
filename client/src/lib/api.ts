import axios, { type AxiosError } from 'axios';
import { API_BASE_URL } from '../config';
import type { AuthUser, RoomSummary } from '../types';

interface ApiErrorBody {
  code?: string;
  message?: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

export const api = axios.create({ baseURL: API_BASE_URL, timeout: 15000 });

let currentToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  currentToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

api.interceptors.request.use((config) => {
  if (currentToken) config.headers.set('Authorization', `Bearer ${currentToken}`);
  return config;
});

api.interceptors.response.use(undefined, (error: AxiosError<ApiErrorBody>) => {
  if (error.response?.status === 401 && currentToken) unauthorizedHandler?.();
  return Promise.reject(error);
});

/** Turns any thrown value into a message that is safe to show to the user. */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    if (error.response?.data?.message) return error.response.data.message;
    if (error.code === 'ECONNABORTED') return 'The server took too long to respond. Please try again.';
    if (!error.response) return 'Cannot reach the StreamSync server. Check your connection and try again.';
  }
  if (error instanceof Error && error.name === 'SocketRequestError') return error.message;
  return fallback;
}

export function isUnauthorizedError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 401;
}

export function getErrorCode(error: unknown): string | undefined {
  if (axios.isAxiosError<ApiErrorBody>(error)) return error.response?.data?.code;
  if (error instanceof Error && 'code' in error && typeof error.code === 'string') return error.code;
  return undefined;
}

export const authApi = {
  signup: (body: { username: string; email?: string; password: string }) =>
    api.post<AuthSession>('/api/auth/signup', body).then((res) => res.data),
  login: (body: { identifier: string; password: string }) =>
    api.post<AuthSession>('/api/auth/login', body).then((res) => res.data),
  me: () => api.get<{ user: AuthUser }>('/api/auth/me').then((res) => res.data.user),
};

export const roomApi = {
  create: (name: string) => api.post<RoomSummary>('/api/rooms', { name }).then((res) => res.data),
  get: (roomId: string) =>
    api.get<RoomSummary>(`/api/rooms/${encodeURIComponent(roomId)}`).then((res) => res.data),
  end: (roomId: string) => api.delete(`/api/rooms/${encodeURIComponent(roomId)}`),
};
