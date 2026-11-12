import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '../theme/useTheme';

/**
 * A labelled text input, for the app's forms. The label is a real label rather
 * than a placeholder, so it stays visible once there is text in the field.
 */
export function Field({
  label,
  hint,
  error,
  ...input
}: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  const { colors, type, space, radius } = useTheme();

  return (
    <View style={{ gap: space.xs }}>
      <Text style={[type.footnote, { color: colors.label2, fontWeight: '600' }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.label2}
        accessibilityLabel={label}
        {...input}
        style={[
          styles.input,
          {
            backgroundColor: colors.bg2,
            borderColor: error ? colors.red : colors.sep,
            borderRadius: radius.md,
            color: colors.label,
            padding: space.md,
          },
          input.style,
        ]}
      />
      {error ? (
        <Text accessibilityRole="alert" style={[type.caption, { color: colors.red }]}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={[type.caption, { color: colors.label2 }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
    // Apple's minimum touch target.
    minHeight: 44,
  },
});
