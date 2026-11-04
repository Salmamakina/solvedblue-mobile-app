import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiErrorMessage, apiBaseUrl } from '../../src/api/client';
import { LINES_QUERY_KEY, linesApi } from '../../src/api/lines';
import { Badge, healthTone } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { useAuthStore } from '../../src/stores/authStore';
import { useTheme } from '../../src/theme/useTheme';
import { percent, relativeTime } from '../../src/utils/format';

export default function AccountScreen() {
  const { colors, type, space } = useTheme();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const queryClient = useQueryClient();

  const { data: lines, error } = useQuery({
    queryKey: [LINES_QUERY_KEY],
    queryFn: linesApi.list,
  });

  async function signOut() {
    await clearAuth();
    // Drop every cached response so the next account does not see this one's data.
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
});
