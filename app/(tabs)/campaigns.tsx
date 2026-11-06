import { useQuery } from '@tanstack/react-query';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { CAMPAIGNS_QUERY_KEY, campaignsApi } from '../../src/api/campaigns';
import { apiErrorMessage } from '../../src/api/client';
import { Badge, campaignTone } from '../../src/components/Badge';
import { Refresh } from '../../src/components/Refresh';
import { Screen } from '../../src/components/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/StateView';
import { useTheme } from '../../src/theme/useTheme';
import { shortTime } from '../../src/utils/format';

export default function CampaignsScreen() {
  const { colors, type, space } = useTheme();

  const { data, isLoading, isRefetching, error, refetch } = useQuery({
    queryKey: [CAMPAIGNS_QUERY_KEY],
    queryFn: campaignsApi.getAll,
  });

  if (isLoading) return <LoadingState label="Loading campaigns" />;
  if (error) {
    return (
      <ErrorState message={apiErrorMessage(error, 'Could not load campaigns')} onRetry={refetch} />
    );
  }

  return (
    <Screen>
      <FlatList
        data={data ?? []}
        keyExtractor={(campaign) => campaign.id}
        refreshControl={<Refresh refreshing={isRefetching} onRefresh={refetch} />}
        ItemSeparatorComponent={() => (
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.sep }} />
        )}
        ListEmptyComponent={
          <EmptyState title="No campaigns" hint="Create one on the web app to see it here." />
        }
        contentContainerStyle={(data?.length ?? 0) === 0 ? styles.grow : undefined}
        renderItem={({ item }) => (
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
            <View style={{ flex: 1 }}>
              <Text style={[type.headline, { color: colors.label }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[type.caption, { color: colors.label2, marginTop: space.xs }]}>
                {item.started_at
                  ? `Started ${shortTime(item.started_at)}`
                  : item.scheduled_start_at
                    ? `Scheduled ${shortTime(item.scheduled_start_at)}`
                    : `Created ${shortTime(item.created_at)}`}
              </Text>
            </View>
            <Badge label={item.status} tone={campaignTone(item.status)} />
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flexGrow: 1 },
});
