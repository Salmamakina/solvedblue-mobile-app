import { useColorScheme } from 'react-native';
import { brand, darkPalette, lightPalette, radius, space, type, type Palette } from './tokens';

export interface Theme {
  colors: Palette;
  brand: typeof brand;
  type: typeof type;
  space: typeof space;
  radius: typeof radius;
  dark: boolean;
}

/**
 * Follows the device appearance.
 *
 * There used to be a stored Light / Dark / System preference behind this. It
 * was dropped: three paths meant three sets of surfaces to keep the brand
 * legible on, and the one that mattered — the phone's own setting — was
 * already the default everyone left it on. iOS and Android both treat
 * appearance as a system-wide choice, and an app that overrides it is the odd
 * one out. `userInterfaceStyle` in app.json is "automatic", which matches.
 */
export function useTheme(): Theme {
  const dark = useColorScheme() === 'dark';
  return { colors: dark ? darkPalette : lightPalette, brand, type, space, radius, dark };
}

/** The light palette regardless of the device, for surfaces that are always light. */
export function useLightTheme(): Theme {
  return { colors: lightPalette, brand, type, space, radius, dark: false };
}
