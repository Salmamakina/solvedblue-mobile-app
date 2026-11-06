import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGoogleSignIn } from '../../src/auth/useGoogleSignIn';
import { GoogleMark, Wordmark } from '../../src/components/Wordmark';
import { useLightTheme } from '../../src/theme/useTheme';

/**
 * Google-only sign-in, matching the web app, where "Sign up now" opens Google
 * for both new and returning users. There is no email and password form.
 *
 * Always light, regardless of the theme preference, so it uses useLightTheme
 * rather than useTheme.
 */
export default function SignInScreen() {
  const { colors, type, space, radius } = useLightTheme();
  const insets = useSafeAreaInsets();
  const { signIn, loading, error, configured } = useGoogleSignIn();

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
        {error ? (
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
            <Text style={[type.footnote, { color: colors.red, fontWeight: '600' }]}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={signIn}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          accessibilityState={{ disabled: loading, busy: loading }}
          style={({ pressed }) => [
            styles.googleButton,
            {
              backgroundColor: colors.bg2,
              borderColor: colors.sep,
              borderRadius: radius.md,
              paddingVertical: space.md,
              paddingHorizontal: space.lg,
              opacity: loading ? 0.6 : pressed ? 0.85 : 1,
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
          New and returning users both sign in with Google.
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
});
