import * as Google from 'expo-auth-session/providers/google';
import { useRouter } from 'expo-router';
import { GoogleAuthProvider, signInWithCredential, signOut } from 'firebase/auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { authApi } from '../api/auth';
import { apiErrorMessage } from '../api/client';
import { firebaseConfigured, getFirebaseAuth } from '../config/firebase';
import { useAuthStore } from '../stores/authStore';

WebBrowser.maybeCompleteAuthSession();

/**
 * Google sign-in, in three steps:
 *
 *   1. expo-auth-session opens the system browser and returns Google's id_token.
 *   2. Firebase exchanges that for a Firebase ID token (signInWithCredential).
 *   3. The backend's /auth/firebase verifies it and returns our own JWT.
 *
 * Step 2 is required and not a detour. The backend calls verifyIdToken, which
 * only accepts Firebase ID tokens: a raw Google token carries aud = the OAuth
 * client id and is rejected for having the wrong audience. The web app gets its
 * Firebase token from signInWithPopup, which needs a browser window and cannot
 * run natively, so the native flow reaches the same place by a different route.
 *
 * expo-auth-session is used rather than a native Google library because the
 * native ones need a development build; this works in Expo Go and the browser.
 */

/** The user closed the browser themselves. Not worth showing as an error. */
const DISMISSED = new Set(['dismiss', 'cancel', 'locked']);

export interface GoogleSignIn {
  signIn: () => void;
  loading: boolean;
  error: string;
  /** False when the build lacks the client ids or the Firebase config. */
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
  const hasClientId = Boolean(webClientId || iosClientId || androidClientId);
  const configured = hasClientId && firebaseConfigured;

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: webClientId,
    iosClientId,
    androidClientId,
  });

  useEffect(() => {
    if (!response) return;

    if (response.type === 'success') {
      const googleIdToken = response.params?.id_token ?? response.authentication?.idToken;
      if (!googleIdToken) {
        setError('Google did not return an identity token. Please try again.');
        return;
      }
      if (handled.current === googleIdToken) return;
      handled.current = googleIdToken;

      setExchanging(true);
      setError('');

      void (async () => {
        const auth = getFirebaseAuth();
        try {
          const credential = GoogleAuthProvider.credential(googleIdToken);
          const result = await signInWithCredential(auth, credential);
          const firebaseToken = await result.user.getIdToken();

          const { data } = await authApi.loginWithFirebase(firebaseToken);
          await setAuth(data.token, data.user);
          router.replace('/(tabs)/home');
        } catch (err) {
          setError(apiErrorMessage(err, 'Sign-in failed. Please try again.'));
        } finally {
          // The backend's JWT is the session now; the Firebase user is not needed.
          await signOut(auth).catch(() => undefined);
          setExchanging(false);
        }
      })();
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
