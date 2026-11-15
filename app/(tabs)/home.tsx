import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiErrorMessage } from '../../src/api/client';
import { dailyUsage, HOME_QUERY_KEY, homeApi, type HomeSetup } from '../../src/api/home';
import { AppHeader } from '../../src/components/AppHeader';
import { Badge, campaignTone } from '../../src/components/Badge';
import { Card } from '../../src/components/Card';
import { ProgressBar } from '../../src/components/ProgressBar';
import { Screen } from '../../src/components/Screen';
import { ErrorState, LoadingState } from '../../src/components/StateView';
import {
  useScrollToTop,
  type ScrollViewInstance,
} from '../../src/components/useScrollToTop';
import { useAuthStore } from '../../src/stores/authStore';
import { emojiSafe } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/useTheme';
import { listTime, threadTitle } from '../../src/utils/format';
import {
  deltaNote,
  firstName,
  formatHomeDate,
  greetingFor,
  HEALTH_FACTOR_LABELS,
  healthDeltaNote,
  NEAR_CAP,
  rate,
  setupSteps,
} from '../../src/utils/home';

/**
 * Mirrors spyder-web/src/pages/home/Home.tsx: greeting, setup steps, Today
 * usage, the four KPI tiles, account health, then waiting and campaigns.
 *
 * Every section renders whether or not there is data, because a new account has
 * none and still needs to see where its numbers will appear. Each one falls
 * back to the same wording the web uses rather than disappearing.
 */
/** How many waiting conversations the card previews before the Inbox button. */
const WAITING_PREVIEW = 3;

/**
 * TEMPORARY: Campaigns is hidden across the app for now, so the card at the
 * bottom of Home goes with the tab. Typed `boolean` rather than left as the
 * literal `false` so TypeScript keeps checking the block it guards.
 */
const SHOW_CAMPAIGNS: boolean = false;

export default function HomeScreen() {
  const isPlatformAdmin = useAuthStore((s) => s.user?.is_platform_admin === true);
  const { colors, type, space } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  // Home is the longest screen, so tapping the Home tab returns to the top.
  const scrollRef = useScrollToTop<ScrollViewInstance>();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [HOME_QUERY_KEY],
    queryFn: homeApi.summary,
    refetchInterval: 30_000,
  });

  const now = new Date();
  const name = firstName(user?.email);
  const greeting = name ? `${greetingFor(now.getHours())}, ${name}` : greetingFor(now.getHours());

  // The header stays put while the body loads or fails, so the brand and
  // Contact sales never disappear.
  if (isLoading) {
    return (
      <Screen>
        <AppHeader />
        <LoadingState label="Loading your workspace" />
      </Screen>
    );
  }
  if (error || !data) {
    return (
      <Screen>
        <AppHeader />
        <ErrorState
          message={apiErrorMessage(error, 'Could not load home')}
          onRetry={() => refetch()}
        />
      </Screen>
    );
  }

  const usage = dailyUsage(data.lines);
  const steps = setupSteps(data.setup);
  const setupDone = steps.every((step) => data.setup[step.key]);
  const optOutNote =
    data.stats.optout_rate_7d >= 0.02
      ? 'Last 7 days · above the 2% target'
      : 'Last 7 days · keep under 2%';

  return (
    <Screen>
      <AppHeader />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: space.lg, gap: space.lg }}
      >
        <View>
          <Text style={[type.caption, { color: colors.label2 }]}>{formatHomeDate(now)}</Text>
          <Text style={[type.largeTitle, { color: colors.label, marginTop: space.xs }]}>
            {greeting}
          </Text>
        </View>

        {data.paused ? (
          <Card style={{ backgroundColor: colors.orangeTint, borderColor: colors.orange }}>
            <Text style={[type.headline, { color: colors.orange }]}>Sending is paused</Text>
            <Text style={[type.footnote, { color: colors.label, marginTop: space.xs }]}>
              {data.paused.message}
            </Text>
          </Card>
        ) : null}

        {!setupDone ? <SetupCard setup={data.setup} /> : null}

        <Card title="Today">
          {data.lines.length === 0 ? (
            <Text style={[type.footnote, { color: colors.label2 }]}>
              Your line is being set up. We&apos;ll email you when it&apos;s ready.
            </Text>
          ) : (
            <View style={{ gap: space.sm }}>
              <View style={styles.between}>
                <Text
                  style={[
                    type.footnote,
                    {
                      color: usage.cap > 0 && usage.used / usage.cap >= NEAR_CAP
                        ? colors.orange
                        : colors.blue,
                      fontWeight: '600',
                    },
                  ]}
                >
                  Used today
                </Text>
                <Text style={[type.footnote, { color: colors.label2 }]}>
                  {usage.left} left
                </Text>
              </View>
              <Text style={[type.title, { color: colors.label }]}>
                {usage.used} of {usage.cap}
                <Text style={[type.footnote, { color: colors.label2 }]}> new contacts</Text>
              </Text>
              <ProgressBar
                percent={usage.cap > 0 ? (usage.used / usage.cap) * 100 : 0}
                color={
                  usage.cap > 0 && usage.used / usage.cap >= NEAR_CAP
                    ? colors.orange
                    : colors.blue
                }
                label={`${usage.used} of ${usage.cap} new contacts used today`}
              />
            </View>
          )}
        </Card>

        {/* The four tiles the web shows, so the KPIs are visible at zero too. */}
        <View style={styles.tiles}>
          <StatTile label="Sent" value={String(data.stats.sent_today)} note={deltaNote(data.stats.sent_today, data.stats.sent_yesterday)} color={colors.blue} />
          <StatTile label="Replies" value={String(data.stats.replies_today)} note={deltaNote(data.stats.replies_today, data.stats.replies_yesterday)} color={colors.green} />
          <StatTile label="Reply rate" value={rate(data.stats.reply_rate_7d)} note="Last 7 days" color={colors.green} />
          <StatTile label="Opt-outs" value={rate(data.stats.optout_rate_7d)} note={optOutNote} color={colors.orange} />
        </View>

        <Card title="Account health">
          {data.health.score === null ? (
            <View style={{ gap: space.xs }}>
              <Text style={[type.body, { color: colors.label, fontWeight: '600' }]}>
                Not enough sending yet
              </Text>
              <Text style={[type.footnote, { color: colors.label2 }]}>
                Your score appears after 20 messages in a week. It shows how well your sending is
                going.
              </Text>
            </View>
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
                      {healthDeltaNote(data.health.delta)}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={{ marginTop: space.md, gap: space.md }}>
                {data.health.factors.map((factor) => (
                  <View key={factor.key} style={{ gap: space.xs }}>
                    <View style={styles.between}>
                      <Text style={[type.footnote, { color: colors.label }]}>
                        {HEALTH_FACTOR_LABELS[factor.key] ?? factor.key}
                      </Text>
                      <Text style={[type.footnote, { color: colors.label2 }]}>{factor.score}</Text>
                    </View>
                    <ProgressBar percent={factor.score} label={factor.hint} />
                    <Text style={[type.caption, { color: colors.label2 }]}>{factor.hint}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </Card>

        {/* Three rows, not five. This is a preview, and the Inbox button beside
            the title is how you get to the rest, so a longer list here only
            pushed account health and campaigns further down the screen. */}
        <Card
          title="Waiting on you"
          action={
            <Pressable
              onPress={() => router.push('/(tabs)/inbox')}
              accessibilityRole="link"
              accessibilityLabel={
                data.waiting.length > WAITING_PREVIEW
                  ? `Inbox, ${data.waiting.length} waiting`
                  : 'Inbox'
              }
              hitSlop={space.sm}
              style={({ pressed }) => [styles.cardAction, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={[type.footnote, { color: colors.blue, fontWeight: '600' }]}>Inbox</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.blue} accessible={false} />
            </Pressable>
          }
        >
          {data.waiting.length === 0 ? (
            <Text style={[type.footnote, { color: colors.label2 }]}>
              You&apos;re all caught up.
            </Text>
          ) : (
            <View style={{ gap: space.sm }}>
              {data.waiting.slice(0, WAITING_PREVIEW).map((thread) => (
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
                    {/* emojiSafe because this is what the contact sent, and
                        caption is the tightest line height in the ramp, which
                        crops an emoji on Android. See src/theme/tokens.ts. */}
                    <Text
                      style={[emojiSafe(type.caption), { color: colors.label2 }]}
                      numberOfLines={1}
                    >
                      {thread.last_text || (thread.last_at ? 'Attachment' : 'No messages yet')}
                    </Text>
                  </View>
                  <Text style={[type.caption, { color: colors.label2, marginLeft: space.sm }]}>
                    {listTime(thread.last_at)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </Card>

      {/* Campaigns, for a platform admin only. The same gate as the tab and as
          the web's Home, where `showCampaigns = !customer`: a customer who
          cannot open the Campaigns screen should not be shown a card of
          campaign progress they can do nothing with.

          TEMPORARY: hidden from platform admins too, so Home ends at Waiting
          on you, the same way Campaigns is out of the tab bar. Set
          SHOW_CAMPAIGNS back to true to restore it. */}
      {SHOW_CAMPAIGNS && isPlatformAdmin ? (
        <Card title="Campaigns">
          {data.campaigns.length === 0 ? (
            <Text style={[type.footnote, { color: colors.label2 }]}>
              No campaigns running right now.
            </Text>
          ) : (
            <View style={{ gap: space.md }}>
              {data.campaigns.map((campaign) => (
                <View key={campaign.id} style={{ gap: space.xs }}>
                  <View style={styles.between}>
                    <Text
                      style={[type.body, { color: colors.label, flex: 1 }]}
                      numberOfLines={1}
                    >
                      {campaign.name}
                    </Text>
                    <Badge label={campaign.status} tone={campaignTone(campaign.status)} />
                  </View>
                  <ProgressBar
                    percent={campaign.total > 0 ? (campaign.sent / campaign.total) * 100 : 0}
                    label={`${campaign.sent} of ${campaign.total} sent`}
                  />
                  <Text style={[type.caption, { color: colors.label2 }]}>
                    {campaign.sent > 0
                      ? `${campaign.sent} of ${campaign.total} sent`
                      : `${campaign.total} contacts`}{' '}
                    · {campaign.replies} {campaign.replies === 1 ? 'reply' : 'replies'}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Card>
      ) : null}
      </ScrollView>
    </Screen>
  );
}

/** The web's setup card: progress, then the three steps with their next action. */
function SetupCard({ setup }: { setup: HomeSetup }) {
  const { colors, type, space } = useTheme();
  const router = useRouter();
  const steps = setupSteps(setup);
  const done = steps.filter((step) => setup[step.key]).length;
  const nextIndex = steps.findIndex((step) => !setup[step.key]);

  return (
    <Card>
      <Text style={[type.headline, { color: colors.label }]}>Finish setting up</Text>
      <Text style={[type.footnote, { color: colors.label2, marginTop: space.xs }]}>
        {done} of {steps.length} done. Your first reply usually arrives within a day.
      </Text>
      <View style={{ marginTop: space.md }}>
        <ProgressBar
          percent={(done / steps.length) * 100}
          label={`${done} of ${steps.length} steps done`}
        />
      </View>

      <View style={{ marginTop: space.lg, gap: space.md }}>
        {steps.map((step, index) => {
          const isDone = setup[step.key];
          const isNext = index === nextIndex;
          return (
            <View key={step.key} style={styles.step}>
              <View
                style={[
                  styles.dot,
                  {
                    borderColor: isDone ? colors.green : colors.label2,
                    backgroundColor: isDone ? colors.green : 'transparent',
                  },
                ]}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    type.footnote,
                    { color: colors.label, fontWeight: isNext ? '700' : '600' },
                  ]}
                >
                  {step.title}
                </Text>
                {isDone ? (
                  <Text style={[type.caption, { color: colors.label2 }]}>{step.done}</Text>
                ) : step.to ? (
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => router.push(step.to as never)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  >
                    <Text style={[type.caption, { color: colors.blue }]}>{step.todo}</Text>
                  </Pressable>
                ) : (
                  <Text style={[type.caption, { color: colors.label2 }]}>{step.todo}</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

/** One KPI tile. Two per row, so four fill the same grid the web uses. */
function StatTile({
  label,
  value,
  note,
  color,
}: {
  label: string;
  value: string;
  note: string;
  color: string;
}) {
  const { colors, type, radius, space } = useTheme();
  return (
    <View
      style={[
        styles.tile,
        {
          backgroundColor: colors.bg2,
          borderColor: colors.sep,
          borderRadius: radius.lg,
          padding: space.md,
        },
      ]}
    >
      <Text style={[type.footnote, { color, fontWeight: '600' }]}>{label}</Text>
      <Text style={[type.title, { color: colors.label, marginVertical: space.xs }]}>{value}</Text>
      <Text style={[type.caption, { color: colors.label2 }]}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { flexGrow: 1, flexBasis: '45%', borderWidth: StyleSheet.hairlineWidth },
  cardAction: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.6, marginTop: 2 },
});
