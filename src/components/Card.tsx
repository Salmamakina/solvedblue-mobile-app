import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface CardProps {
  children: ReactNode;
  title?: string;
  /**
   * An action at the right-hand end of the title's row: a link to the full list
   * a card is previewing, for instance.
   *
   * A slot on the component rather than a header hand-rolled inside each card,
   * so every card that needs one lines its action up the same way.
   */
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, title, action, style }: CardProps) {
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
      {title || action ? (
        <View style={[styles.header, { marginBottom: space.md, gap: space.sm }]}>
          {title ? (
            <Text style={[type.headline, { color: colors.label, flexShrink: 1 }]}>{title}</Text>
          ) : null}
          {action ? <View style={styles.action}>{action}</View> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
  header: { flexDirection: 'row', alignItems: 'center' },
  action: { marginLeft: 'auto' },
});
