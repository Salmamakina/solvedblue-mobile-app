import * as Google from 'expo-auth-session/providers/google';
import { useRouter } from 'expo-router';
import { GoogleAuthProvider, signInWithCredential, signOut } from 'firebase/auth';
import { useCallback, useRef, useState } from 'react';
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

  const [request, , promptAsync] = Google.useAuthRequest({
    clientId: webClientId,
    iosClientId,
    androidClientId,
  });

  /**
   * Google's id_token for our own session: Firebase first, then the backend.
   *
   * Split out of the flow below so it can be called from `signIn`'s awaited
   * result rather than from an effect. See the comment on `signIn`.
   */
  const completeSignIn = useCallback(
    async (googleIdToken: string) => {
      if (handled.current === googleIdToken) return;
      handled.current = googleIdToken;

      setExchanging(true);
      setError('');

      const auth = getFirebaseAuth();
      try {
        const credential = GoogleAuthProvider.credential(googleIdToken);
        const result = await signInWithCredential(auth, credential);
        const firebaseToken = await result.user.getIdToken();

        const { data } = await authApi.loginWithFirebase(firebaseToken);
        // The store is what the root layout's guard watches, so setting it is
        // what actually moves the app to Home. The replace below is for the
        // case where the guard has already settled.
        await setAuth(data.token, data.user);
        router.replace('/(tabs)/home');
      } catch (err) {
        setError(apiErrorMessage(err, 'Sign-in failed. Please try again.'));
      } finally {
        // The backend's JWT is the session now; the Firebase user is not needed.
        await signOut(auth).catch(() => undefined);
        setExchanging(false);
      }
    },
    [router, setAuth]
  );

  /**
   * Opens Google and finishes the exchange with whatever it hands back.
   *
   * The result is taken from `promptAsync()`'s promise rather than from the
   * `response` state this hook used to watch in an effect. That change is the
   * difference between this working and not, and the reason is specific:
   *
   * Expo Router owns deep linking. The redirect in a development build is
   * `spyder://oauthredirect` — `makeRedirectUri` ignores its `native` option
   * unless `executionEnvironment` is Standalone or Bare, and a build made with
   * expo-dev-client reports StoreClient, the same as Expo Go. So the redirect
   * is a URL with a path, Expo Router matches it as a route, finds nothing, and
   * navigates to its Unmatched Route screen. That unmounts the sign-in screen
   * and this hook with it, so the effect watching `response` never ran and the
   * authorization code was dropped on the floor.
   *
   * A promise continuation does not care that the component unmounted: the
   * exchange finishes, `setAuth` writes the session, and the root layout's
   * guard moves the app to Home. The earlier comment here reasoned the other
   * way round, but it was written before the flow had ever been run against a
   * real Google client (ROADMAP P0.1).
   */
  const signIn = useCallback(() => {
    setError('');
    if (!configured) {
      setError('Sign-in is unavailable right now. Please try again later.');
      return;
    }

    void (async () => {
      const result = await promptAsync();

      if (result.type === 'success') {
        const googleIdToken = result.params?.id_token ?? result.authentication?.idToken;
        if (!googleIdToken) {
          setError('Google did not return an identity token. Please try again.');
          return;
        }
        await completeSignIn(googleIdToken);
        return;
      }

      if (result.type === 'error') {
        setError(result.error?.message || 'Could not sign in with Google.');
        return;
      }

      // Dismissing the browser is a choice, not a failure.
      if (!DISMISSED.has(result.type)) {
        setError('Could not sign in with Google.');
      }
    })();
  }, [completeSignIn, configured, promptAsync]);

  return {
    signIn,
    loading: exchanging || (configured && !request),
    error,
    configured,
  };
}
