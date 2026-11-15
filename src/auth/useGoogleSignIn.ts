import { exchangeCodeAsync } from 'expo-auth-session';
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
 * Google sign-in, in four steps:
 *
 *   1. expo-auth-session opens the system browser and returns an authorization
 *      code (Google allows nothing else from an installed app).
 *   2. exchangeCodeAsync trades the code for Google's id_token.
 *   3. Firebase exchanges that for a Firebase ID token (signInWithCredential).
 *   4. The backend's /auth/firebase verifies it and returns our own JWT.
 *
 * Step 3 is required and not a detour. The backend calls verifyIdToken, which
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
    /*
     * The library can exchange the authorization code itself, but only from an
     * effect inside the mounted screen, and it writes the result to the
     * `response` tuple slot this hook does not read. `exchangeForIdToken`
     * below does it instead. Switching the library's copy off is not tidying:
     * an authorization code is single-use, so running both exchanges would
     * leave one of them failing with invalid_grant.
     */
    shouldAutoExchangeCode: false,
  });

  /**
   * Trades Google's authorization code for an id_token.
   *
   * On a device the provider always asks for `response_type=code` — Google
   * refuses the implicit flow from an installed app — so the prompt result
   * carries `code` and no token at all. Reading `params.id_token` from it, as
   * this hook did, could only ever fail. The exchange needs the same client id
   * and redirect URI the request used, plus its PKCE verifier, so it reads them
   * off `request` rather than recomputing them.
   */
  const exchangeForIdToken = useCallback(
    async (code: string): Promise<string | undefined> => {
      if (!request) return undefined;
      const token = await exchangeCodeAsync(
        {
          clientId: request.clientId,
          redirectUri: request.redirectUri,
          code,
          extraParams: request.codeVerifier
            ? { code_verifier: request.codeVerifier }
            : undefined,
        },
        Google.discovery
      );
      return token.idToken;
    },
    [request]
  );

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
   * Expo Router owns deep linking. The redirect on Android is
   * `spyder:///oauthredirect?code=...`, a URL with a path, which the router
   * would match as a route and miss — `app/+native-intent.ts` is what stops it
   * showing Unmatched Route over the top of this screen. A promise
   * continuation survives an unmount anyway, so the exchange finishes either
   * way; the effect this replaced did not.
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
        setExchanging(true);
        try {
          // params.id_token is only ever set on the web, where the response
          // type is a token rather than a code.
          const googleIdToken =
            result.params?.id_token ??
            result.authentication?.idToken ??
            (result.params?.code ? await exchangeForIdToken(result.params.code) : undefined);

          if (!googleIdToken) {
            setError('Google did not return an identity token. Please try again.');
            return;
          }
          await completeSignIn(googleIdToken);
        } catch (err) {
          setError(apiErrorMessage(err, 'Could not sign in with Google.'));
        } finally {
          setExchanging(false);
        }
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
  }, [completeSignIn, configured, exchangeForIdToken, promptAsync]);

  return {
    signIn,
    loading: exchanging || (configured && !request),
    error,
    configured,
  };
}
