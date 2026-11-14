import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { CAMPAIGNS_QUERY_KEY, campaignsApi, type Metrics } from '../../src/api/campaigns';
import { apiErrorMessage } from '../../src/api/client';
import { Badge, campaignTone } from '../../src/components/Badge';
import { Card } from '../../src/components/Card';
import { ProgressBar } from '../../src/components/ProgressBar';
import { Screen } from '../../src/components/Screen';
import { ErrorState, LoadingState } from '../../src/components/StateView';
import { useTheme } from '../../src/theme/useTheme';
import { percent, prettyPhone, shortTime } from '../../src/utils/format';

/**
 * How a campaign is doing. The web's campaign view, minus the editing: the one
 * thing you want on a phone after starting a send is whether it is landing.
 *
 * Two requests rather than one, because /campaigns/:id carries the recipients
 * and /campaigns/:id/metrics the rates, and the rates are the part worth
 * refreshing while a campaign is running.
 */
export default function CampaignScreen() {
  const { colors, type, space } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const campaign = useQuery({
    queryKey: [CAMPAIGNS_QUERY_KEY, id],
    queryFn: () => campaignsApi.get(id),
    enabled: Boolean(id),
  });

  const metrics = useQuery({
    queryKey: [CAMPAIGNS_QUERY_KEY, id, 'metrics'],
    queryFn: () => campaignsApi.getMetrics(id),
    enabled: Boolean(id),
    // An active campaign's numbers move. Polling only while it is sending, so a
    // finished campaign is not refetched for nothing.
    refetchInterval: campaign.data?.campaign.status === 'active' ? 30_000 : false,
  });

  if (campaign.isLoading) {
    return (
      <Screen>
        <LoadingState label="Loading campaign" />
      </Screen>
    );
  }
  if (campaign.error || !campaign.data) {
    return (
      <Screen>
        <ErrorState
          message={apiErrorMessage(campaign.error, 'Could not load that campaign')}
          onRetry={() => void campaign.refetch()}
        />
      </Screen>
    );
  }

  const { campaign: row, recipients } = campaign.data;
  const m = metrics.data;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <Card>
          <View style={{ gap: space.sm }}>
            <View style={styles.head}>
              <Text style={[type.title, { color: colors.label, flex: 1 }]}>{row.name}</Text>
              <Badge label={row.status} tone={campaignTone(row.status)} />
            </View>
            <Text style={[type.caption, { color: colors.label2 }]}>
              {row.workflow_name ? `${row.workflow_name} · ` : ''}
              {row.started_at
                ? `Started ${shortTime(row.started_at)}`
                : row.scheduled_start_at
                  ? `Scheduled ${shortTime(row.scheduled_start_at)}`
                  : `Created ${shortTime(row.created_at)}`}
            </Text>
          </View>
        </Card>

        {metrics.isLoading ? (
          <Card title="Results">
            <Text style={[type.footnote, { color: colors.label2 }]}>Loading…</Text>
          </Card>
        ) : !m ? (
          <Card title="Results">
            <Text style={[type.footnote, { color: colors.label2 }]}>
              {apiErrorMessage(metrics.error, 'No results yet')}
            </Text>
          </Card>
        ) : (
          <>
            <Card title="Results">
              <View style={{ gap: space.lg }}>
                {/* The reply rate first and as a bar: it is the number the
                    campaign is judged on, and a bar reads at a glance where
                    four figures in a row do not. */}
                <View style={{ gap: space.xs }}>
                  <View style={styles.between}>
                    <Text style={[type.footnote, { color: colors.label }]}>Reply rate</Text>
                    <Text style={[type.headline, { color: colors.label }]}>
                      {percent(m.reply_rate)}
                    </Text>
                  </View>
                  <ProgressBar
                    percent={(m.reply_rate ?? 0) * 100}
                    color={colors.green}
                    label={`Reply rate ${percent(m.reply_rate)}`}
                  />
                </View>

                <View style={styles.figures}>
                  <Figure label="Sent" value={m.total_sent} />
                  <Figure label="Replies" value={m.total_replies} />
                  <Figure label="Failed" value={m.total_failed} tone="bad" />
                  <Figure label="Waiting" value={m.pending_messages + m.pending_recipients} />
                </View>

                {m.close_rate > 0 ? (
                  <Text style={[type.caption, { color: colors.label2 }]}>
                    Close rate {percent(m.close_rate)}
                  </Text>
                ) : null}
              </View>
            </Card>

            {/* Per channel, because which one is replying is what decides
                whether the lines are working. Only channels that actually sent
                appear: a row of zeroes for a channel this campaign never used
                says nothing. */}
            <Card title="By channel">
              <View style={{ gap: space.md }}>
                {channelRows(m).map((channel) => (
                  <View key={channel.label} style={styles.between}>
                    <Text style={[type.body, { color: colors.label }]}>{channel.label}</Text>
                    <Text style={[type.footnote, { color: colors.label2 }]}>
                      {channel.sent.toLocaleString()} sent · {channel.replies.toLocaleString()}{' '}
                      {channel.replies === 1 ? 'reply' : 'replies'} · {percent(channel.rate)}
                    </Text>
                  </View>
                ))}
                {channelRows(m).length === 0 ? (
                  <Text style={[type.footnote, { color: colors.label2 }]}>
                    Nothing has gone out yet.
                  </Text>
                ) : null}
              </View>
            </Card>
          </>
        )}

        <Card title={`Recipients · ${recipients.length}`}>
          <View style={{ gap: space.md }}>
            {recipients.length === 0 ? (
              <Text style={[type.footnote, { color: colors.label2 }]}>
                This campaign has no recipients.
              </Text>
            ) : (
              recipients.slice(0, RECIPIENT_PREVIEW).map((recipient, index) => (
                <View key={recipient.id ?? `${recipient.phone_number}-${index}`} style={styles.between}>
                  <View style={{ flex: 1 }}>
                    <Text style={[type.body, { color: colors.label }]} numberOfLines={1}>
                      {recipient.name?.trim() ||
                        prettyPhone(recipient.phone_number) ||
                        recipient.email ||
                        'Unknown'}
                    </Text>
                    {recipient.error_message ? (
                      <Text style={[type.caption, { color: colors.red }]} numberOfLines={1}>
                        {recipient.error_message}
                      </Text>
                    ) : recipient.sent_at ? (
                      <Text style={[type.caption, { color: colors.label2 }]}>
                        {recipient.delivery_method ? `${recipient.delivery_method} · ` : ''}
                        {shortTime(recipient.sent_at)}
                      </Text>
                    ) : null}
                  </View>
                  <Badge
                    label={recipient.message_status ?? recipient.status ?? 'pending'}
                    tone={recipientTone(recipient.message_status ?? recipient.status)}
                  />
                </View>
              ))
            )}

            {recipients.length > RECIPIENT_PREVIEW ? (
              <Text style={[type.caption, { color: colors.label2 }]}>
                Showing the first {RECIPIENT_PREVIEW} of {recipients.length.toLocaleString()}. The
                whole list is on the web app.
              </Text>
            ) : null}
          </View>
        </Card>

        {/* No back link here. The only way in is the campaigns list, so the
            header's arrow is the one exit and a second control saying the same
            thing just moved the exit somewhere you had to scroll to find.
            Nothing else belongs here either: starting and stopping stay on the
            list, next to every other campaign. */}
      </ScrollView>
    </Screen>
  );
}

/** Enough to see how a send is going without loading ten thousand rows into a ScrollView. */
const RECIPIENT_PREVIEW = 50;

/** One figure in the grid. */
function Figure({ label, value, tone }: { label: string; value: number; tone?: 'bad' }) {
  const { colors, type, space } = useTheme();
  // Zero failures is good news, so it is not coloured as a problem.
  const color = tone === 'bad' && value > 0 ? colors.red : colors.label;

  return (
    <View style={styles.figure}>
      <Text style={[type.title, { color }]}>{value.toLocaleString()}</Text>
      <Text style={[type.caption, { color: colors.label2, marginTop: space.xs }]}>{label}</Text>
    </View>
  );
}

/** The channels this campaign actually used, with each one's own reply rate. */
function channelRows(m: Metrics) {
  return [
    { label: 'iMessage', sent: m.imessage_sent, replies: m.imessage_replies, rate: m.imessage_reply_rate },
    { label: 'SMS', sent: m.sms_sent, replies: m.sms_replies, rate: m.sms_reply_rate },
    { label: 'RCS', sent: m.rcs_sent, replies: m.rcs_replies, rate: m.rcs_reply_rate },
  ].filter((channel) => channel.sent > 0);
}

function recipientTone(status: string | null | undefined): 'good' | 'bad' | 'info' | 'neutral' {
  if (status === 'delivered' || status === 'sent') return 'good';
  if (status === 'failed' || status === 'cancelled') return 'bad';
  if (status === 'sending' || status === 'queued') return 'info';
  return 'neutral';
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  figures: { flexDirection: 'row', flexWrap: 'wrap' },
  figure: { width: '50%', paddingVertical: 8 },
});
