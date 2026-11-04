import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiErrorMessage } from '../../src/api/client';
import { dailyUsage, HOME_QUERY_KEY, homeApi } from '../../src/api/home';
import { Badge, campaignTone, healthTone } from '../../src/components/Badge';
import { Card } from '../../src/components/Card';
import { Refresh } from '../../src/components/Refresh';
import { Screen } from '../../src/components/Screen';
import { ErrorState, LoadingState } from '../../src/components/StateView';
import { useTheme } from '../../src/theme/useTheme';
import { percent, shortTime, threadTitle } from '../../src/utils/format';

/** Mirrors the web Home: health, today's numbers, lines, waiting replies, campaigns. */
export default function HomeScreen() {
  const { colors, type, space } = useTheme();
  const router = useRouter();

  const { data, isLoading, isRefetching, error, refetch } = useQuery({
    queryKey: [HOME_QUERY_KEY],
    queryFn: homeApi.summary,
  });

  if (isLoading) return <LoadingState label="Loading your workspace" />;
  if (error || !data) {
    return (
      <ErrorState message={apiErrorMessage(error, 'Could not load home')} onRetry={() => refetch()} />
    );
  }

  const usage = dailyUsage(data.lines);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, gap: space.lg }}
        refreshControl={<Refresh refreshing={isRefetching} onRefresh={refetch} />}
      >
        {data.paused ? (
          <Card style={{ backgroundColor: colors.orangeTint, borderColor: colors.orange }}>
            <Text style={[type.headline, { color: colors.orange }]}>Sending is paused</Text>
            <Text style={[type.footnote, { color: colors.label, marginTop: space.xs }]}>
              {data.paused.message}
            </Text>
          </Card>
        ) : null}

        <Card title="Account health">
          {data.health.score === null ? (
            <Text style={[type.footnote, { color: colors.label2 }]}>
              Not enough sending yet to score. Send at least 20 messages in a week.
            </Text>
          ) : (
            <View>
              <View style={styles.row}>
                <Text style={[type.largeTitle, { color: colors.label }]}>{data.health.score}</Text>
                <View style={{ marginLeft: space.md, gap: space.xs }}>
                  {data.health.word ? (
                    <Badge
                      label={data.health.word}
                      tone={
                        data.health.word === 'Healthy'
                          ? 'good'
                          : data.health.word === 'Watch'
                            ? 'warn'
                            : 'bad'
                      }
                    />
                  ) : null}
                  {data.health.delta !== null ? (
                    <Text style={[type.caption, { color: colors.label2 }]}>
                      {data.health.delta >= 0 ? '+' : ''}
                      {data.health.delta} vs last week
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={{ marginTop: space.md, gap: space.xs }}>
                {data.health.factors.map((factor) => (
                  <View key={factor.key} style={styles.between}>
                    <Text style={[type.footnote, { color: colors.label2, flex: 1 }]}>
                      {factor.hint}
                    </Text>
                    <Text style={[type.footnote, { color: colors.label, fontWeight: '600' }]}>
                      {factor.score}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </Card>

        <Card title="Today">
          <View style={styles.statRow}>
            <Stat label="Sent" value={String(data.stats.sent_today)} />
            <Stat label="Replies" value={String(data.stats.replies_today)} />
            <Stat label="Reply rate 7d" value={percent(data.stats.reply_rate_7d)} />
          </View>
          <Text style={[type.caption, { color: colors.label2, marginTop: space.md }]}>
            {usage.used} of {usage.cap} new contacts used today, {usage.left} left.
          </Text>
        </Card>

        <Card title={`Lines (${data.lines.length})`}>
          {data.lines.length === 0 ? (
            <Text style={[type.footnote, { color: colors.label2 }]}>No lines connected yet.</Text>
          ) : (
            <View style={{ gap: space.md }}>
              {data.lines.map((line) => (
                <View key={line.id} style={styles.between}>
                  <View style={{ flex: 1 }}>
                    <Text style={[type.body, { color: colors.label }]}>{line.name}</Text>
                    <Text style={[type.caption, { color: colors.label2 }]}>
                      {line.used_today}/{line.cap} today
                      {line.warmup.complete ? '' : ` · warmup day ${line.warmup.day}`}
                    </Text>
                  </View>
                  <Badge label={line.health} tone={healthTone(line.health)} />
                </View>
              ))}
            </View>
          )}
        </Card>

        <Card title="Waiting on you">
          {data.waiting.length === 0 ? (
            <Text style={[type.footnote, { color: colors.label2 }]}>
              Nothing waiting. Every conversation has a reply.
            </Text>
          ) : (
            <View style={{ gap: space.sm }}>
              {data.waiting.slice(0, 5).map((thread) => (
                <Pressable
                  key={thread.contact}
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: '/chat/[phone]',
                      params: {
                        phone: thread.phone_number,
                        name: threadTitle(thread.display_name, thread.phone_number),
                      },
                    })
                  }
                  style={({ pressed }) => [styles.between, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[type.body, { color: colors.label }]} numberOfLines={1}>
                      {threadTitle(thread.display_name, thread.phone_number)}
                    </Text>
                    <Text style={[type.caption, { color: colors.label2 }]} numberOfLines={1}>
                      {thread.last_text ?? 'No messages yet'}
                    </Text>
                  </View>
                  <Text style={[type.caption, { color: colors.label2, marginLeft: space.sm }]}>
                    {shortTime(thread.last_at)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </Card>

        <Card title="Campaigns">
          {data.campaigns.length === 0 ? (
            <Text style={[type.footnote, { color: colors.label2 }]}>No campaigns running.</Text>
          ) : (
            <View style={{ gap: space.md }}>
              {data.campaigns.map((campaign) => (
                <View key={campaign.id} style={styles.between}>
                  <View style={{ flex: 1 }}>
                    <Text style={[type.body, { color: colors.label }]} numberOfLines={1}>
                      {campaign.name}
                    </Text>
                    <Text style={[type.caption, { color: colors.label2 }]}>
                      {campaign.sent}/{campaign.total} sent · {campaign.replies} replies
                    </Text>
                  </View>
                  <Badge label={campaign.status} tone={campaignTone(campaign.status)} />
                </View>
              ))}
            </View>
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors, type } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={[type.title, { color: colors.label }]}>{value}</Text>
      <Text style={[type.caption, { color: colors.label2 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statRow: { flexDirection: 'row', gap: 12 },
});
