import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { authApi } from '../../src/api/auth';
import { apiErrorMessage } from '../../src/api/client';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { useAuthStore } from '../../src/stores/authStore';
import { useTheme } from '../../src/theme/useTheme';

export default function SignInScreen() {
  const { colors, type, space, radius } = useTheme();
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await authApi.login({ email: email.trim(), password });
      await setAuth(data.token, data.user);
      router.replace('/(tabs)/home');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not sign in'));
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.bg2,
      borderColor: colors.sep,
      borderRadius: radius.md,
      color: colors.label,
      padding: space.md,
    },
  ];

  return (
    <Screen edgeToEdge>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { padding: space.xl }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[type.largeTitle, { color: colors.label }]}>Spyder</Text>
          <Text style={[type.body, { color: colors.label2, marginTop: space.sm }]}>
            Sign in to your workspace.
          </Text>

          <View style={{ marginTop: space.xxl, gap: space.md }}>
            <View>
              <Text style={[type.footnote, { color: colors.label2, marginBottom: space.xs }]}>
                Email
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@company.com"
                placeholderTextColor={colors.label2}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                inputMode="email"
                accessibilityLabel="Email"
                style={inputStyle}
              />
            </View>

            <View>
              <Text style={[type.footnote, { color: colors.label2, marginBottom: space.xs }]}>
                Password
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.label2}
                secureTextEntry
                autoComplete="current-password"
                onSubmitEditing={submit}
                returnKeyType="go"
                accessibilityLabel="Password"
                style={inputStyle}
              />
            </View>

            {error ? (
              <Text style={[type.footnote, { color: colors.red }]} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}

            <Button
              label="Sign in"
              onPress={submit}
              disabled={!canSubmit}
              loading={busy}
              style={{ marginTop: space.sm }}
            />
          </View>

          <Text style={[type.caption, { color: colors.label2, marginTop: space.xl }]}>
            Google sign-in is next: the backend already accepts a Firebase ID token on the same
            endpoint the web app uses.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center' },
  input: { borderWidth: StyleSheet.hairlineWidth, fontSize: 15, minHeight: 44 },
});
