import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface CardProps {
  children: ReactNode;
  title?: string;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, title, style }: CardProps) {
  const { colors, type, radius, space } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.bg2,
          borderColor: colors.sep,
          borderRadius: radius.lg,
          padding: space.lg,
        },
        style,
      ]}
    >
      {title ? (
        <Text style={[type.headline, { color: colors.label, marginBottom: space.md }]}>{title}</Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
});
