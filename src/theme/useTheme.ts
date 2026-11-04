import { useColorScheme } from 'react-native';
import { darkPalette, lightPalette, radius, space, type, type Palette } from './tokens';

export interface Theme {
  colors: Palette;
  type: typeof type;
  space: typeof space;
  radius: typeof radius;
  dark: boolean;
}

/** Follows the system appearance, the same default the web app uses ("system"). */
export function useTheme(): Theme {
  const dark = useColorScheme() === 'dark';
  return {
    colors: dark ? darkPalette : lightPalette,
    type,
    space,
    radius,
    dark,
  };
}
