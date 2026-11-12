import api from './client';

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
  /** Exchanges a Google identity token for the backend's own JWT. */
  loginWithFirebase: (firebaseToken: string) =>
    api.post<AuthResponse>('/auth/firebase', { firebaseToken }),

  /**
   * Exchanges an Apple identity token for the backend's own JWT. No Firebase
   * detour: the backend verifies Apple's token against Apple's published keys
   * itself (spyder-backend/src/services/appleAuth.ts).
   *
   * `nonce` is the unhashed value whose SHA-256 was handed to Apple, so the
   * backend can prove the token belongs to this sign-in.
   */
  loginWithApple: (identityToken: string, nonce: string) =>
    api.post<AuthResponse>('/auth/apple', { identityToken, nonce }),
  getMe: () => api.get<{ user: MeUser; pending_invite?: PendingInvite | null }>('/auth/me'),
  acceptInvite: () => api.post<AuthResponse>('/auth/invite/accept'),
  declineInvite: () => api.post('/auth/invite/decline'),
};
