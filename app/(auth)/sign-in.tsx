import * as AppleAuthentication from 'expo-apple-authentication';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppleSignIn } from '../../src/auth/useAppleSignIn';
import { useGoogleSignIn } from '../../src/auth/useGoogleSignIn';
import { GoogleMark, Wordmark } from '../../src/components/Wordmark';
import { useLightTheme } from '../../src/theme/useTheme';

/**
 * Sign-in. Google everywhere, matching the web app, where "Sign up now" opens
 * Google for both new and returning users; plus Sign in with Apple on iOS,
 * which App Store Review guideline 4.8 requires wherever a third-party login is
 * offered. There is no email and password form on either path.
 *
 * Always light, regardless of the theme preference, so it uses useLightTheme
 * rather than useTheme.
 */
export default function SignInScreen() {
  const { colors, type, space, radius } = useLightTheme();
  const insets = useSafeAreaInsets();
  const { signIn, loading, error, configured } = useGoogleSignIn();
  const apple = useAppleSignIn();

  // One slot, so two providers cannot both report a failure at once and stack
  // two banners. Whichever was tried last is the one the message is about.
  const message = apple.error || error;
  // Each button disables while either is running: starting Apple halfway
  // through the Google exchange would race two sessions into setAuth.
  const busy = loading || apple.loading;

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.bg2,
          paddingTop: insets.top + space.xl,
          paddingBottom: insets.bottom + space.xl,
          paddingHorizontal: space.xl,
        },
      ]}
    >
      <StatusBar style="dark" />

      <View style={styles.center}>
        <Wordmark />
        <Text
          style={[
            type.body,
            { color: colors.label2, marginTop: space.md, textAlign: 'center', maxWidth: 300 },
          ]}
        >
          Real iMessages at scale, with SMS fallback.
        </Text>
      </View>

      <View style={{ gap: space.md }}>
        {message ? (
          <View
            accessibilityRole="alert"
            style={{
              backgroundColor: colors.redTint,
              borderColor: colors.red,
              borderWidth: StyleSheet.hairlineWidth,
              borderRadius: radius.md,
              padding: space.md,
            }}
          >
            <Text style={[type.footnote, { color: colors.red, fontWeight: '600' }]}>{message}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={signIn}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          accessibilityState={{ disabled: busy, busy: loading }}
          style={({ pressed }) => [
            styles.googleButton,
            {
              backgroundColor: colors.bg2,
              borderColor: colors.sep,
              borderRadius: radius.md,
              paddingVertical: space.md,
              paddingHorizontal: space.lg,
              opacity: busy ? 0.6 : pressed ? 0.85 : 1,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.label} />
          ) : (
            <>
              <GoogleMark />
              <Text style={[type.headline, { color: colors.label }]}>Continue with Google</Text>
            </>
          )}
        </Pressable>

        {/* Apple's own button rather than one of ours: the Human Interface
            Guidelines dictate its wording, logo and colours, and the system
            one is approved, localised and accessible without us matching them
            by hand. Rendered only where the system supports it, so Android and
            the web never see a control that cannot work. */}
        {apple.available ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={radius.md}
            onPress={busy ? () => undefined : apple.signIn}
            style={[styles.appleButton, { opacity: busy ? 0.6 : 1 }]}
          />
        ) : null}

        {!configured ? (
          <Text style={[type.caption, { color: colors.label2, textAlign: 'center' }]}>
            Sign-in is not configured in this build.
          </Text>
        ) : null}

        <Text
          style={[
            type.caption,
            { color: colors.label2, textAlign: 'center', marginTop: space.sm },
          ]}
        >
          New and returning users sign in the same way.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 50,
  },
  // The native button draws nothing without an explicit height, and 50 matches
  // the Google button above it so the pair reads as one stack.
  appleButton: { width: '100%', height: 50 },
});
