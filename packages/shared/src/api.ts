/** REST contracts. Field names match the JSON the API returns. */

export interface PublicUser {
  id: string;
  username: string;
  email: string | null;
  createdAt: string;
}

export interface SignupRequest {
  username: string;
  password: string;
  email?: string;
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface AuthSession {
  token: string;
  user: PublicUser;
}

export interface CurrentUserResponse {
  user: PublicUser;
}

export interface CreateRoomRequest {
  name?: string;
}

export interface RoomSummary {
  roomId: string;
  name: string;
  owner: string;
  ownerId: string;
  createdAt: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  database: 'connected' | 'disconnected';
  uptimeSeconds: number;
}
