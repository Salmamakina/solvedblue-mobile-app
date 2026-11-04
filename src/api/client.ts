import axios from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '../stores/authStore';

/**
 * Mobile port of spyder-web/src/api/client.ts.
 *
 * Differences from the web client, all forced by the platform:
 *  - the base URL comes from EXPO_PUBLIC_API_URL, not import.meta.env, and there
 *    is no dev proxy to fall back on, so a mobile build always needs a full URL;
 *  - the token is read from the store synchronously, but the store hydrates from
 *    SecureStore (async) rather than localStorage;
 *  - a 401 cannot redirect with window.location. It clears the session and the
 *    root layout's guard moves to the sign-in screen.
 *
 * The backend accepts this unchanged: authenticateToken takes either a JWT or a
 * Firebase ID token on `Authorization: Bearer`, and its CORS allows requests
 * with no Origin header, which is every native request.
 */

const configuredUrl =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;

if (!configuredUrl) {
  console.error('EXPO_PUBLIC_API_URL is not set. Copy .env.example to .env and point it at the backend.');
}

/** Trailing slashes would produce //api, which some proxies treat as a different route. */
export const apiBaseUrl = `${(configuredUrl ?? '').replace(/\/+$/, '')}/api`;

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
  // Longer than the web's 10s: phones drop onto mobile data mid-request.
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
