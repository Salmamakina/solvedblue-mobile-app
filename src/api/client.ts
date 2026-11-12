import axios from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '../stores/authStore';

/**
 * Where the API lives. `EXPO_PUBLIC_API_URL` is inlined into the bundle at build
 * time, so each EAS profile sets its own (see eas.json): a LAN IP for a device
 * build, staging for preview, production for store builds.
 *
 * The fallback in app.json is production over HTTPS rather than localhost. A
 * release build that somehow ships without the variable then talks to
 * production instead of to the phone itself, and nothing in the app ever asks
 * for a plain http:// origin — iOS App Transport Security and Android's
 * cleartext block would both refuse one.
 *
 * An empty string counts as unset: `??` would accept it, and Expo inlines
 * `EXPO_PUBLIC_API_URL=` in a .env file as "".
 */
const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const configuredUrl =
  envUrl || (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl || '';

/** Trailing slashes would produce //api, which some proxies treat as a different route. */
export const apiBaseUrl = `${configuredUrl.replace(/\/+$/, '')}/api`;

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const code = error.response?.data?.code;

    // Only a 401 means the session is gone. A 403 is a signed-in user who may not
    // do this one thing, so it rejects like any other error and the caller says so.
    if (status === 401 && code !== 'impersonation_ended') {
      void useAuthStore.getState().clearAuth();
    }
    return Promise.reject(error);
  }
);

/** The backend's error shape: { error: string, code?: string }. */
export function apiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  const data = (error as { response?: { data?: { error?: unknown } } } | null)?.response?.data;
  if (data && typeof data.error === 'string') return data.error;
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === 'string' && message ? message : fallback;
}

export default api;
