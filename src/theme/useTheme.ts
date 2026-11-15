import { useColorScheme } from 'react-native';
import { useThemeStore } from '../stores/themeStore';
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
 * Follows the stored preference; `system`, the default, defers to the phone.
 *
 * `userInterfaceStyle` in app.json stays "automatic", which is what lets
 * useColorScheme report the phone's setting at all. The preference overrides
 * the result here rather than the native setting, so Light and Dark hold even
 * when the phone switches at sunset.
 */
export function useTheme(): Theme {
  const systemDark = useColorScheme() === 'dark';
  const preference = useThemeStore((s) => s.preference);
  const dark = preference === 'system' ? systemDark : preference === 'dark';
  return { colors: dark ? darkPalette : lightPalette, brand, type, space, radius, dark };
}

/** The light palette regardless of the preference, for surfaces that are always light. */
export function useLightTheme(): Theme {
  return { colors: lightPalette, brand, type, space, radius, dark: false };
}
