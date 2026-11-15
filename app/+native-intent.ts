/**
 * Deep links that are not routes.
 *
 * Expo Router subscribes to every incoming `Linking` URL and navigates to the
 * matching file under `app/`. On Android that includes the Google sign-in
 * redirect: `expo-web-browser` has no native auth session there, so its
 * polyfill listens for the same URL event the router listens to. The redirect
 * is `spyder:///oauthredirect?code=...` (a URL with a path, because
 * `makeRedirectUri` only honours its `native` option when the execution
 * environment is Standalone or Bare, and a dev-client build reports
 * StoreClient), so the router looks for a route called `oauthredirect`, finds
 * nothing, and shows the Unmatched Route screen on top of sign-in.
 *
 * Returning `null` tells the router to ignore the URL and stay where it is.
 * The auth session still receives it, so `promptAsync()` resolves and the
 * sign-in screen — still mounted — finishes the exchange and moves to Home.
 *
 * iOS never hit this: `ASWebAuthenticationSession` captures the redirect
 * inside the browser session, so it never becomes an app deep link.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  if (path.includes('oauthredirect')) return null;
  return path;
}
