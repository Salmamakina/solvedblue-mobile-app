import * as Google from 'expo-auth-session/providers/google';
import { useRouter } from 'expo-router';
import { GoogleAuthProvider, signInWithCredential, signOut } from 'firebase/auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
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

/**
 * Expo inlines an unset `EXPO_PUBLIC_*` as the empty string, not as undefined.
 * That matters here because the provider resolves its client id with `??`,
 * which does not treat `""` as missing — so a blank line in `.env` would be
 * passed to Google as the client id instead of falling back. The same trap
 * already bit `src/api/client.ts` and produced a base URL of `/api`.
 */
function envClientId(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

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

  const webClientId = envClientId(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
  const iosClientId = envClientId(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);
  const androidClientId = envClientId(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID);

  /*
   * The provider picks the client id by platform — `iosClientId` on iOS,
   * `androidClientId` on Android, `webClientId` otherwise — so having *a*
   * client id is not the same as having the one this platform will read.
   *
   * It matters because the fallback is worse than nothing: with no iOS id, the
   * provider would send the **web** client id with a custom-scheme redirect,
   * which Google rejects for a web client. A missing id should disable the
   * button and say so, not produce an opaque error from Google.
   */
  const platformClientId =
    Platform.select({ ios: iosClientId, android: androidClientId, default: webClientId }) ??
    webClientId;
  const configured = Boolean(platformClientId) && firebaseConfigured;

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: webClientId,
    iosClientId,
    androidClientId,
  });

  /*
   * react-hooks/set-state-in-effect is disabled for this effect, deliberately.
   *
   * `response` is state owned by expo-auth-session: it changes when the system
   * browser comes back, which is exactly the "subscribe to an external system"
   * case the rule's own documentation exempts. There is nowhere else to react
   * to it, and the alternative — awaiting promptAsync() in signIn instead —
   * would restructure the one flow in this app that has never been run end to
   * end against a real Google client (see ROADMAP P0.1). Not worth rewriting
   * blind to satisfy a linter.
   */
  /* eslint-disable react-hooks/set-state-in-effect */
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
  /* eslint-enable react-hooks/set-state-in-effect */

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
