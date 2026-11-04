import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { Button } from './Button';

/** The three states every list screen needs: loading, failed, empty. */

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  const { colors, type, space } = useTheme();
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={colors.blue} />
      <Text style={[type.footnote, { color: colors.label2, marginTop: space.md }]}>{label}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors, type, space } = useTheme();
  return (
    <View style={styles.center}>
      <Text style={[type.headline, { color: colors.label, textAlign: 'center' }]}>
        Something went wrong
      </Text>
      <Text
        style={[
          type.footnote,
          { color: colors.label2, textAlign: 'center', marginTop: space.sm, marginBottom: space.lg },
        ]}
      >
        {message}
      </Text>
      {onRetry ? <Button label="Try again" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  const { colors, type, space } = useTheme();
  return (
    <View style={styles.center}>
      <Text style={[type.headline, { color: colors.label, textAlign: 'center' }]}>{title}</Text>
      {hint ? (
        <Text
          style={[type.footnote, { color: colors.label2, textAlign: 'center', marginTop: space.sm }]}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
