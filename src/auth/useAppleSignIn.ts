import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { authApi } from '../api/auth';
import { apiErrorMessage } from '../api/client';
import { useAuthStore } from '../stores/authStore';

/**
 * Sign in with Apple, which App Store Review guideline 4.8 requires alongside
 * Google. iOS and iPadOS only: `available` is false everywhere else, so the
 * button is simply absent on Android and in a browser.
 *
 * Two steps rather than Google's three. There is no Firebase detour, because
 * the backend verifies Apple's identity token against Apple's published keys
 * directly (spyder-backend/src/services/appleAuth.ts); Google has to go through
 * Firebase only because the backend's verifyIdToken expects a Firebase token.
 *
 * The nonce is the standard replay defence: a random value is generated here,
 * Apple is handed its SHA-256 and echoes that back inside the signed token, and
 * the original is sent to the backend to compare against. A token lifted from
 * one sign-in therefore cannot be presented as another.
 */

/** Apple's code for the user dismissing the sheet. Not an error worth showing. */
const CANCELED = 'ERR_REQUEST_CANCELED';

export interface AppleSignIn {
  signIn: () => void;
  loading: boolean;
  error: string;
  /** False on a device or platform with no Sign in with Apple. */
  available: boolean;
}

export function useAppleSignIn(): AppleSignIn {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    // Resolves false rather than throwing off iOS, but it is still a native
    // call, so a screen that unmounts first must not set state.
    void AppleAuthentication.isAvailableAsync()
      .then((ok) => {
        if (active) setAvailable(ok);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(() => {
    setError('');
    setLoading(true);

    void (async () => {
      try {
        const rawNonce = Crypto.randomUUID();
        const hashedNonce = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          rawNonce
        );

        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
          nonce: hashedNonce,
        });

        if (!credential.identityToken) {
          setError('Apple did not return an identity token. Please try again.');
          return;
        }

        const { data } = await authApi.loginWithApple(credential.identityToken, rawNonce);
        await setAuth(data.token, data.user);
        router.replace('/(tabs)/home');
      } catch (err) {
        if ((err as { code?: string } | null)?.code === CANCELED) return;
        setError(apiErrorMessage(err, 'Could not sign in with Apple.'));
      } finally {
        setLoading(false);
      }
    })();
  }, [router, setAuth]);

  return { signIn, loading, error, available };
}
