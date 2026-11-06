import { Text, type StyleProp, type TextStyle } from 'react-native';
import { brand, type } from '../theme/tokens';

/**
 * The "Solvedblue" wordmark, split the way the web Wordmark splits it: "Solved"
 * in brand navy and "blue" in brand blue.
 *
 * One Text with a nested Text so it stays a single string for screen readers,
 * which read "Solvedblue" rather than two fragments.
 */
export function Wordmark({
  size = 34,
  style,
}: {
  size?: number;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      accessibilityRole="header"
      style={[
        { fontSize: size, fontWeight: '800', letterSpacing: -0.5, color: brand.navy },
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
