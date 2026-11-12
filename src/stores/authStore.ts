import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { DEV_BYPASS_AUTH, DEV_BYPASS_TOKEN, DEV_BYPASS_USER } from '../config/devBypass';

const TOKEN_KEY = 'spyder-token';
const USER_KEY = 'spyder-user';

export interface AuthUser {
  id: string;
  email: string;
  organization_id?: string | null;
  is_platform_admin?: boolean;
  role_name?: string | null;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  /** False until the stored session has been read once. */
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setAuth: (token: string, user: AuthUser) => Promise<void>;
  updateUser: (user: AuthUser) => Promise<void>;
  clearAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  hydrated: false,

  hydrate: async () => {
    try {
      // TEMPORARY: with the auth bypass on, start from a real backend-signed
      // session instead of reading SecureStore. See src/config/devBypass.ts.
      if (DEV_BYPASS_AUTH) {
        set({ token: DEV_BYPASS_TOKEN, user: { ...DEV_BYPASS_USER }, hydrated: true });
        return;
      }

      const [token, rawUser] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        SecureStore.getItemAsync(USER_KEY),
      ]);
      set({
        token,
        user: rawUser ? (JSON.parse(rawUser) as AuthUser) : null,
        hydrated: true,
      });
    } catch {
      // A corrupt or unreadable store must not wedge the app on the splash screen.
      set({ token: null, user: null, hydrated: true });
    }
  },

  setAuth: async (token, user) => {
    set({ token, user });
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, token),
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
    ]);
  },

  updateUser: async (user) => {
    set({ user });
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  },

  clearAuth: async () => {
    // TEMPORARY: with the bypass on there is no sign-in screen to return to, so
    // a stray 401 would strand the app on a blank guard. Keep the dev session.
    // See src/config/devBypass.ts.
    if (DEV_BYPASS_AUTH) return;

    set({ token: null, user: null });
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
  },
}));
