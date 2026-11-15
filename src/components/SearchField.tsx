import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface SearchFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  /** Names what is being searched, for a screen reader. */
  label: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The search box above a list, matching the web's `inbox-search` and the
 * contacts search: a magnifier, the field, and a clear button once there is
 * something to clear.
 *
 * `returnKeyType="search"` and `clearButtonMode` are iOS conveniences; the
 * explicit clear button is there because Android has neither.
 */
export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search',
  label,
  style,
}: SearchFieldProps) {
  const { colors, space, radius } = useTheme();

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.bg2,
          borderColor: colors.sep,
          borderRadius: radius.md,
          paddingHorizontal: space.md,
          gap: space.sm,
        },
        style,
      ]}
    >
      <Ionicons name="search" size={16} color={colors.label2} accessible={false} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.label2}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={label}
        style={[styles.input, { color: colors.label }]}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={space.sm}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Ionicons name="close-circle" size={18} color={colors.label2} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 0 },
});
