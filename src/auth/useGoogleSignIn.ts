import * as Google from 'expo-auth-session/providers/google';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { apiErrorMessage } from '../api/client';
import { authApi } from '../api/auth';
import { useAuthStore } from '../stores/authStore';

WebBrowser.maybeCompleteAuthSession();

/**
 * Google sign-in, the mobile counterpart of spyder-web/src/auth/useGoogleSignIn.ts.
 *
 * The web app uses the Firebase JS SDK's signInWithPopup, which needs a browser
 * window and cannot work in a native app. Here expo-auth-session opens the system
 * browser and returns Google's id_token directly, which the backend accepts on the
 * same /auth/firebase endpoint the web app posts to. The backend verifies it with
 * the Admin SDK, so the exchange is identical from its side.
 *
 * expo-auth-session is used rather than a native Google library because the native
 * ones require a development build; this works in Expo Go and in the browser.
 */

/** The user closed the browser themselves. Not worth showing as an error. */
const DISMISSED = new Set(['dismiss', 'cancel', 'locked']);

export interface GoogleSignIn {
  signIn: () => void;
  loading: boolean;
  error: string;
  /** False when no client id is configured, so the UI can say sign-in is unavailable. */
  configured: boolean;
}

export function useGoogleSignIn(): GoogleSignIn {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState('');
  const [exchanging, setExchanging] = useState(false);
  /** Guards against running the exchange twice for one response. */
  const handled = useRef<string | null>(null);

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  const configured = Boolean(webClientId || iosClientId || androidClientId);

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: webClientId,
    iosClientId,
    androidClientId,
  });

  useEffect(() => {
    if (!response) return;

    if (response.type === 'success') {
      const idToken = response.params?.id_token ?? response.authentication?.idToken;
      if (!idToken) {
        setError('Google did not return an identity token. Please try again.');
        return;
      }
      if (handled.current === idToken) return;
      handled.current = idToken;

      setExchanging(true);
      setError('');
      authApi
        .loginWithFirebase(idToken)
        .then(async ({ data }) => {
          await setAuth(data.token, data.user);
          router.replace('/(tabs)/home');
        })
        .catch((err) => setError(apiErrorMessage(err, 'Sign-in failed. Please try again.')))
        .finally(() => setExchanging(false));
      return;
    }

    if (response.type === 'error') {
      setError(response.error?.message || 'Could not sign in with Google.');
      return;
    }

    if (!DISMISSED.has(response.type)) {
      setError('Could not sign in with Google.');
    }
  }, [response, setAuth, router]);

  const signIn = useCallback(() => {
    setError('');
    if (!configured) {
      setError('Sign-in is unavailable right now. Please try again later.');
      return;
    }
    void promptAsync();
  }, [configured, promptAsync]);

  return {
    signIn,
    loading: exchanging || (configured && !request),
    error,
    configured,
  };
}
