import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';

interface ScreenProps {
  children: ReactNode;
  /** Adds the bottom inset. Leave off inside a tab screen, where the bar already covers it. */
  edgeToEdge?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** The page background and the safe-area padding every screen needs. */
export function Screen({ children, edgeToEdge = false, style }: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.bg,
          paddingBottom: edgeToEdge ? insets.bottom : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
