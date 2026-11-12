import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/useTheme';

/** The web's .home-bar: a thin track with a filled portion. */
export function ProgressBar({
  percent,
  color,
  label,
}: {
  /** 0 to 100. */
  percent: number;
  color?: string;
  label?: string;
}) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <View
      style={[styles.track, { backgroundColor: colors.sep }]}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ now: Math.round(clamped), min: 0, max: 100 }}
    >
      <View
        style={[styles.fill, { width: `${clamped}%`, backgroundColor: color ?? colors.blue }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
});
