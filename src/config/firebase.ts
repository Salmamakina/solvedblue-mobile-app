import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, inMemoryPersistence, setPersistence, type Auth } from 'firebase/auth';

/**
 * Firebase is used for one thing only: turning a Google OAuth token into a
 * Firebase ID token, which is what the backend's verifyIdToken accepts. The
 * session that matters is the backend's own JWT, held in SecureStore, so
 * persistence is in-memory and the Firebase user is signed out immediately
 * after the exchange.
 *
 * Must be the same project the backend verifies against, otherwise the token's
 * `aud` claim will not match and verification fails.
 */

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

/** Whether the exchange can work at all in this build. */
export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let authInstance: Auth | undefined;

function getFirebaseApp(): FirebaseApp {
  if (!firebaseConfigured) {
    throw new Error('This build has no Firebase configuration.');
  }
  return getApps().length ? getApp() : initializeApp(firebaseConfig as Record<string, string>);
}

export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(getFirebaseApp());
    // Nothing should outlive the exchange, so the SDK is told not to store it.
    void setPersistence(authInstance, inMemoryPersistence);
  }
  return authInstance;
}
