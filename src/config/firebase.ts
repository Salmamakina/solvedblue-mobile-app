import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

/**
 * Mobile port of spyder-web/src/config/firebase.ts.
 *
 * Same project as the web app, so a user's account works on both. Initialization
 * is deferred for the same reason it is on web: getAuth throws
 * auth/invalid-api-key on an empty config, and at module scope that throw would
 * take down the first screen that merely imports this file.
 */

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Whether sign-in can work at all in this build. The UI uses it to say
 * "sign-in is unavailable" rather than offering a button that cannot succeed.
 */
export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let authInstance: Auth | undefined;

export function getFirebaseApp(): FirebaseApp {
  if (!firebaseConfigured) {
    throw new Error(
      'Google sign-in is not available: this build has no Firebase configuration. Set the EXPO_PUBLIC_FIREBASE_* variables and restart.'
    );
  }
  return getApps().length ? getApp() : initializeApp(firebaseConfig as Record<string, string>);
}

export function getFirebaseAuth(): Auth {
  authInstance ??= getAuth(getFirebaseApp());
  return authInstance;
}
