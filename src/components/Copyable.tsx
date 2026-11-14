import * as Clipboard from 'expo-clipboard';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/useTheme';

/**
 * A read-only value with a copy button, for the MCP and API addresses and for
 * the MCP client config.
 *
 * Copying rather than selecting: a long address or a block of JSON is not
 * something anyone should have to select accurately on a phone, and text
 * selection inside a scroll view fights the scroll.
 *
 * `block` is for something with newlines, which must not be clipped to one
 * line the way a single address is.
 */
export function Copyable({
  label,
  value,
  block = false,
}: {
  label: string;
  value: string;
  /** Lay the value out over several lines, for a config snippet. */
  block?: boolean;
}) {
  const { colors, type, space, radius } = useTheme();

  return (
    <View style={{ gap: space.xs }}>
      <Text style={[type.caption, { color: colors.label2, fontWeight: '600' }]}>{label}</Text>
      <Pressable
        onPress={() => {
          void Clipboard.setStringAsync(value);
          Alert.alert('Copied', `${label} copied to the clipboard.`);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Copy ${label}`}
        style={({ pressed }) => [
          block ? styles.blockBox : styles.inlineBox,
          {
            backgroundColor: colors.fill2,
            borderColor: colors.sep,
            borderRadius: radius.md,
            opacity: pressed ? 0.6 : 1,
          },
        ]}
      >
        <Text
          style={[
            type.caption,
            { color: colors.label, flex: block ? undefined : 1, fontFamily: undefined },
          ]}
          numberOfLines={block ? undefined : 1}
        >
          {value}
        </Text>
        <Text
          style={[
            type.caption,
            { color: colors.blue, fontWeight: '600', marginTop: block ? space.sm : 0 },
          ]}
        >
          Copy
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  inlineBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  blockBox: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
});
