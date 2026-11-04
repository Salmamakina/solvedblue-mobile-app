import api from './client';

/** Mirrors spyder-web/src/api/auth.ts. Keep the two in step. */

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: { id: string; email: string; organization_id?: string | null };
}

export interface PendingInvite {
  organization_id: string;
  organization_name: string;
  role: string;
  invited_by_email: string | null;
}

export interface MeUser {
  id: string;
  email: string;
  organization_id?: string | null;
  is_platform_admin?: boolean;
  role_id?: string | null;
  role_name?: string | null;
  role_display_name?: string | null;
}

export const authApi = {
  login: (data: LoginData) => api.post<AuthResponse>('/auth/login', data),
  loginWithFirebase: (firebaseToken: string) =>
    api.post<AuthResponse>('/auth/firebase', { firebaseToken }),
  getMe: () => api.get<{ user: MeUser; pending_invite?: PendingInvite | null }>('/auth/me'),
  acceptInvite: () => api.post<AuthResponse>('/auth/invite/accept'),
  declineInvite: () => api.post('/auth/invite/decline'),
};
