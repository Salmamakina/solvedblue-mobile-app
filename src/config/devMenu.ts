/**
 * Hides expo-dev-client's floating tools button — the gear that sits on top of
 * the app in a development build and drags around over the header.
 *
 * The dev menu itself is untouched: shake the device, or press `m` in the
 * terminal running Metro, and it still opens. This only takes the button off
 * the screen so it stops covering the UI being worked on.
 *
 * Loaded with `require` inside the `__DEV__` branch on purpose. expo-dev-menu
 * is a transitive dependency of expo-dev-client, it has no native module on
 * web, and a release build has no dev menu at all; a static import would pull
 * all of that into every bundle to call one function that only matters here.
 */
export function hideDevToolsButton(): void {
  if (!__DEV__) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const devMenu = require('expo-dev-menu') as {
      setToolsButtonVisible?: (visible: boolean) => void;
    };
    devMenu.setToolsButtonVisible?.(false);
  } catch {
    // Expo Go, web, or a build without expo-dev-client: there is no button.
  }
}
