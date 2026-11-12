import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { CAMPAIGNS_QUERY_KEY, campaignsApi, type Campaign } from '../../src/api/campaigns';
import { apiErrorMessage } from '../../src/api/client';
import { WORKFLOWS_QUERY_KEY, workflowsApi } from '../../src/api/workflows';
import { AppHeader } from '../../src/components/AppHeader';
import { Badge, campaignTone } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/StateView';
import { useTheme } from '../../src/theme/useTheme';
import { shortTime } from '../../src/utils/format';
import { describeSteps, stepsOf } from '../../src/utils/workflowSteps';

export default function CampaignsScreen() {
  const { colors, type, space } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [CAMPAIGNS_QUERY_KEY],
    queryFn: campaignsApi.getAll,
  });

  // Shown above the list so the workflow-then-campaign order is visible, and
  // so an org with no workflow is not stuck at an empty campaign picker.
  const workflows = useQuery({
    queryKey: [WORKFLOWS_QUERY_KEY],
    queryFn: workflowsApi.list,
  });

  const published = (workflows.data ?? []).filter((w) => w.status === 'published');

  const start = useMutation({
    mutationFn: (id: string) => campaignsApi.start(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CAMPAIGNS_QUERY_KEY] }),
    onError: (err) => Alert.alert('Campaigns', apiErrorMessage(err, 'Could not start it')),
  });

  const end = useMutation({
    mutationFn: (id: string) => campaignsApi.end(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CAMPAIGNS_QUERY_KEY] }),
    onError: (err) => Alert.alert('Campaigns', apiErrorMessage(err, 'Could not stop it')),
  });

  /** Sending to real people, so confirm the count before it goes out. */
  function confirmStart(campaign: Campaign) {
    Alert.alert(
      'Start this campaign?',
      `"${campaign.name}" will begin sending to its recipients.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start', style: 'default', onPress: () => start.mutate(campaign.id) },
      ]
    );
  }

  if (isLoading) {
    return (
      <Screen>
        <AppHeader />
        <LoadingState label="Loading campaigns" />
      </Screen>
    );
  }
  if (error) {
    return (
      <Screen>
        <AppHeader />
        <ErrorState
          message={apiErrorMessage(error, 'Could not load campaigns')}
          onRetry={refetch}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader />

      <View style={[styles.actions, { paddingHorizontal: space.lg, paddingTop: space.md }]}>
        <Button
          label="New campaign"
          onPress={() => router.push('/campaigns/new')}
          style={styles.action}
        />
        <Button
          label="New workflow"
          variant="secondary"
          onPress={() => router.push('/workflows/new')}
          style={styles.action}
        />
      </View>

      <FlatList
        data={data ?? []}
        keyExtractor={(campaign) => campaign.id}
        style={{ marginTop: space.md }}
        ItemSeparatorComponent={() => (
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.sep }} />
        )}
        ListHeaderComponent={
          published.length === 0 ? (
            <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md }}>
              <Text style={[type.footnote, { color: colors.label2 }]}>
                A campaign sends the messages in a workflow. Create a workflow first, then build a
                campaign around it.
              </Text>
            </View>
          ) : (
            <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md }}>
              <Text style={[type.caption, { color: colors.label2 }]}>
                {published.length} {published.length === 1 ? 'workflow' : 'workflows'} ready ·{' '}
                {published
                  .slice(0, 2)
                  .map((w) => {
                    const parsed = stepsOf(w.definition);
                    return parsed.fits ? `${w.name} (${describeSteps(parsed.steps)})` : w.name;
                  })
                  .join(', ')}
              </Text>
            </View>
          )
        }
        ListEmptyComponent={
          <EmptyState title="No campaigns" hint="Create a workflow, then a campaign to run it." />
        }
        contentContainerStyle={(data?.length ?? 0) === 0 ? styles.grow : undefined}
        renderItem={({ item }) => {
          const busy =
            (start.isPending && start.variables === item.id) ||
            (end.isPending && end.variables === item.id);

          return (
            <View
              style={[
                styles.row,
                {
                  backgroundColor: colors.bg2,
                  paddingHorizontal: space.lg,
                  paddingVertical: space.md,
                },
              ]}
            >
              {/* The name and dates open the campaign's results. Only this
                  part, not the whole row: Start and Stop sit on the right and
                  a tap meant for one of them must not also navigate. */}
              <Pressable
                onPress={() =>
                  router.push({ pathname: '/campaigns/[id]', params: { id: item.id } })
                }
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${item.status}. Open results`}
                style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.6 : 1 })}
              >
                <Text style={[type.headline, { color: colors.label }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[type.caption, { color: colors.label2, marginTop: space.xs }]}>
                  {item.workflow_name ? `${item.workflow_name} · ` : ''}
                  {item.started_at
                    ? `Started ${shortTime(item.started_at)}`
                    : item.scheduled_start_at
                      ? `Scheduled ${shortTime(item.scheduled_start_at)}`
                      : `Created ${shortTime(item.created_at)}`}
                </Text>
              </Pressable>

              <View style={styles.meta}>
                <Badge label={item.status} tone={campaignTone(item.status)} />
                {item.status === 'draft' || item.status === 'scheduled' ? (
                  <Action label="Start" busy={busy} onPress={() => confirmStart(item)} />
                ) : item.status === 'active' ? (
                  <Action
                    label="Stop"
                    danger
                    busy={busy}
                    onPress={() => end.mutate(item.id)}
                  />
                ) : null}
              </View>
            </View>
          );
        }}
      />
    </Screen>
  );
}

function Action({
  label,
  onPress,
  busy,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  busy: boolean;
  danger?: boolean;
}) {
  const { colors, type } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: busy, busy }}
      style={({ pressed }) => [styles.actionText, { opacity: busy ? 0.4 : pressed ? 0.6 : 1 }]}
    >
      <Text style={[type.footnote, { color: danger ? colors.red : colors.blue, fontWeight: '600' }]}>
        {busy ? '…' : label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
  actionText: { minHeight: 32, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  meta: { alignItems: 'flex-end', gap: 4, marginLeft: 8 },
  grow: { flexGrow: 1 },
});
