import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiBaseUrl, apiErrorMessage } from '../../src/api/client';
import { LINES_QUERY_KEY, linesApi } from '../../src/api/lines';
import { Badge, healthTone } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { useAuthStore } from '../../src/stores/authStore';
import { THEME_OPTIONS, useThemeStore } from '../../src/stores/themeStore';
import { useTheme } from '../../src/theme/useTheme';
import { percent, relativeTime } from '../../src/utils/format';

export default function AccountScreen() {
  const { colors, type, space, radius } = useTheme();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  const queryClient = useQueryClient();

  const { data: lines, error } = useQuery({
    queryKey: [LINES_QUERY_KEY],
    queryFn: linesApi.list,
  });

  async function signOut() {
    await clearAuth();
    // Drop every cached response so the next account cannot see this one's data.
    queryClient.clear();
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <Card title="Signed in as">
          <Text style={[type.headline, { color: colors.label }]}>{user?.email ?? 'Unknown'}</Text>
          {user?.role_name ? (
            <Text style={[type.caption, { color: colors.label2, marginTop: space.xs }]}>
              {user.role_name}
            </Text>
          ) : null}
          {user?.is_platform_admin ? (
            <View style={{ marginTop: space.sm }}>
              <Badge label="Platform admin" tone="info" />
            </View>
          ) : null}
        </Card>

        <Card title="Preferences">
          <Text style={[type.footnote, { color: colors.label2, marginBottom: space.sm }]}>
            Appearance
          </Text>
          <View
            style={[
              styles.segment,
              { backgroundColor: colors.fill, borderRadius: radius.md, padding: 3 },
            ]}
          >
            {THEME_OPTIONS.map(({ key, label }) => {
              const active = key === preference;
              return (
                <Pressable
                  key={key}
                  onPress={() => void setPreference(key)}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    styles.segmentItem,
                    {
                      backgroundColor: active ? colors.bg2 : 'transparent',
                      borderRadius: radius.sm,
                      opacity: pressed && !active ? 0.6 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      type.footnote,
                      {
                        color: active ? colors.label : colors.label2,
                        fontWeight: active ? '600' : '400',
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[type.caption, { color: colors.label2, marginTop: space.sm }]}>
            {preference === 'system'
              ? 'Following your device appearance.'
              : `Always ${preference}.`}
          </Text>
        </Card>

        <Card title="Lines">
          {error ? (
            <Text style={[type.footnote, { color: colors.red }]}>
              {apiErrorMessage(error, 'Could not load lines')}
            </Text>
          ) : !lines || lines.length === 0 ? (
            <Text style={[type.footnote, { color: colors.label2 }]}>No lines connected.</Text>
          ) : (
            <View style={{ gap: space.md }}>
              {lines.map((line) => (
                <View key={line.id} style={styles.between}>
                  <View style={{ flex: 1 }}>
                    <Text style={[type.body, { color: colors.label }]}>{line.name}</Text>
                    <Text style={[type.caption, { color: colors.label2 }]}>
                      {line.platform === 'android' ? 'Text fallback' : 'iMessage'} ·{' '}
                      {line.used_today}/{line.cap} today · {percent(line.reply_rate_7d)} replies
                    </Text>
                    {line.last_seen ? (
                      <Text style={[type.caption, { color: colors.label2 }]}>
                        Seen {relativeTime(line.last_seen)}
                      </Text>
                    ) : null}
                  </View>
                  <Badge label={line.health} tone={healthTone(line.health)} />
                </View>
              ))}
            </View>
          )}
        </Card>

        <Card title="Connection">
          <Text style={[type.caption, { color: colors.label2 }]} selectable>
            {apiBaseUrl}
          </Text>
        </Card>

        <Button label="Sign out" variant="danger" onPress={signOut} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  segment: { flexDirection: 'row', gap: 3 },
  segmentItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 38 },
});
