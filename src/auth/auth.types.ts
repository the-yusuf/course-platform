export type Role = 'student' | 'admin';

export const ROLE_RANK: Record<Role, number> = {
  student: 1,
  admin: 2,
};

// what we put inside the access token
export interface AccessTokenPayload {
  sub: string; // user id
  sid: string; // session id
}

// what the guard attaches to request.user
export interface AuthUser {
  id: string;
  role: Role;
  sessionId: string;
}
