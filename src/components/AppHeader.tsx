import { useRouter, usePathname } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';
import { ContactSalesButton } from './ContactSalesButton';
import { Wordmark } from './Wordmark';

/** Where the brand goes, the same place the web's header logo links to. */
const HOME_ROUTE = '/(tabs)/home';

/**
 * The app's top bar, mirroring the web header in
 * spyder-web/src/components/Layout.tsx: the Solvedblue mark and wordmark, then
 * Contact sales.
 *
 * Carries no page name. The tab bar already says which screen you are on, and
 * each screen's own content makes it obvious, so a title line here was just
 * repetition taking vertical space.
 *
 * Replaces the stock navigator header so the brand is present on every screen,
 * which is what the web does. The navigator's own header is turned off in
 * app/(tabs)/_layout.tsx, and this sits inside each screen's Screen instead.
 */
export function AppHeader() {
  const { colors, space } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  // The navigator's header used to clear the status bar. With it off, this bar
  // is the top of the screen and has to do that itself.
  const insets = useSafeAreaInsets();

  // On Home the brand is not a link. Pushing Home from Home would stack a
  // second copy of it, so the back arrow would then lead to the same screen.
  const onHome = pathname === '/home' || pathname === '/';

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.bg2,
          borderBottomColor: colors.sep,
          paddingHorizontal: space.lg,
          paddingTop: insets.top + space.sm,
          paddingBottom: space.sm,
        },
      ]}
    >
      <View style={styles.brandRow}>
        {/* The mark and the wordmark are one target rather than two, so the
            whole brand is tappable and screen readers announce one link. */}
        <Pressable
          onPress={() => router.navigate(HOME_ROUTE)}
          disabled={onHome}
          accessibilityRole={onHome ? 'header' : 'link'}
          accessibilityLabel={onHome ? 'Solvedblue' : 'Solvedblue, go to Home'}
          hitSlop={space.sm}
          style={({ pressed }) => [styles.brand, { opacity: pressed && !onHome ? 0.6 : 1 }]}
        >
          <Image
            source={require('../../assets/solvedblue-mark.png')}
            style={styles.mark}
            resizeMode="contain"
            // Decorative: the wordmark beside it already says "Solvedblue", so
            // announcing the image too would read the brand twice.
            accessible={false}
          />
          {/* decorative: the Pressable above carries the label, so the
              wordmark must not also announce itself as a heading inside it. */}
          <Wordmark size={20} decorative />
        </Pressable>
        {/* Pushed to the end of the brand row, so the title below starts at
            the edge. Shares its implementation with the quoted plan's
            "Talk to us", which opens the same calendar. */}
        <ContactSalesButton style={styles.sales} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderBottomWidth: StyleSheet.hairlineWidth },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // minHeight 44, Apple's minimum target, since this is now a control.
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  mark: { width: 22, height: 22 },
  sales: { marginLeft: 'auto' },
});
