/**
 * TEMPORARY: signs the app in with a real backend JWT so the screens can be
 * worked on while Google sign-in is unavailable.
 *
 * Why sign-in is unavailable, corrected 2026-11-11. The original note here
 * said the fix was to authorise
 * https://auth.expo.io/@solvedblue-app/spyder-mobile-app as a redirect URI.
 * **That was wrong.** The Expo auth proxy is legacy and expo-auth-session 58
 * does not use it: on a real build the redirect is
 * `com.spyder.mobile:/oauthredirect`, taken from the application id. There is
 * nothing to authorise, because iOS and Android OAuth client types have no
 * redirect-URI field — iOS matches on bundle id, Android on package plus SHA-1.
 *
 * The actual blockers are two, both now addressed in code:
 *   1. EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID and _ANDROID_CLIENT_ID are empty, and
 *      those clients do not exist yet. Creating them needs the signing SHA-1,
 *      which needs an EAS build.
 *   2. The app claimed only the `spyder` URL scheme, so the redirect could not
 *      come back into it. app.json now claims `com.spyder.mobile` as well.
 *
 * And one that is not a bug: Google sign-in **cannot work in Expo Go** on this
 * SDK, because there the redirect becomes `exp://<lan-ip>:8081/--/`, which
 * Google refuses for an installed app. It needs a development build.
 *
 * The token below is NOT a fake. It is signed with the same JWT_SECRET that
 * spyder-backend verifies with, so the API treats it as a genuine session and
 * every screen shows real rows from the local Postgres. Regenerate it with:
 *
 *   cd spyder-backend && node mint-dev-token.js
 *
 * It is scoped to the local backend only: staging and production sign their
 * tokens with different secrets and will reject it.
 *
 * Turn this off by setting DEV_BYPASS_AUTH to false. `__DEV__` is false in a
 * release build, so a shipped app can never bypass the guard even if this is
 * left on by mistake.
 */
export const DEV_BYPASS_AUTH = __DEV__ && false;

/**
 * Real JWT for salma@offa.com (the only local user with an organisation).
 * Expires 30 days from 2026-11-07. Mint a fresh one if the API starts 401ing.
 */
export const DEV_BYPASS_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkODQ4MjExZS02NTUxLTRkMWUtYTA5Yy1mYzhjYTU0ODdlODIiLCJpYXQiOjE3OTQwNzYwMjEsImV4cCI6MTc5NjY2ODAyMX0.UJAsd3sxlFM0jt4Su_UCO43gqb27hiSJ6R9QQXR-CBQ';

/** Matches the row the token belongs to; /auth/me replaces this on first load. */
export const DEV_BYPASS_USER = {
  id: 'd848211e-6551-4d1e-a09c-fc8ca5487e82',
  email: 'salma@offa.com',
  organization_id: 'b0fc321c-9484-4ba5-9d05-e1071a2a1e00',
  is_platform_admin: false,
  role_name: null,
} as const;
