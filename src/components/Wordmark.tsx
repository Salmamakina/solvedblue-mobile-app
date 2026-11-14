import { Text, type StyleProp, type TextStyle } from 'react-native';
import { brand, type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

/**
 * The "Solvedblue" wordmark, split the way the web Wordmark splits it: "Solved"
 * then "blue" in brand blue.
 *
 * One Text with a nested Text so it stays a single string for screen readers,
 * which read "Solvedblue" rather than two fragments.
 *
 * "Solved" follows the theme. It is brand navy (#0B1630) on light, which is
 * the artwork's colour, but navy on the dark palette's near-black background
 * (#1C1C1E) is about 1.3:1 and effectively invisible, so dark mode uses the
 * label colour instead. "blue" (#1A7BFF) carries on both and stays fixed, so
 * the mark is still recognisably the brand either way.
 *
 * `onLight` forces the light treatment for a surface that is always light
 * whatever the preference, which is what the sign-in screen is.
 */
export function Wordmark({
  size = 34,
  onLight = false,
  decorative = false,
  style,
}: {
  size?: number;
  onLight?: boolean;
  /** For a wordmark inside a control that already carries its own label. */
  decorative?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const { colors, dark } = useTheme();
  const solved = !onLight && dark ? colors.label : brand.navy;

  return (
    <Text
      accessible={decorative ? false : undefined}
      accessibilityRole={decorative ? undefined : 'header'}
      style={[
        { fontSize: size, fontWeight: '800', letterSpacing: -0.5, color: solved },
        style,
      ]}
    >
      Solved<Text style={{ color: brand.blue }}>blue</Text>
    </Text>
  );
}

/** The Google "G", drawn as text since the asset is not bundled yet. */
export function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <Text
      accessible={false}
      style={{ fontSize: size, fontWeight: '700', color: '#4285F4', lineHeight: size * 1.2 }}
    >
      G
    </Text>
  );
}

export { type };
