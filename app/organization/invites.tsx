import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { ACCOUNT_QUERY_KEY, accountApi } from '../../src/api/account';
import { apiErrorMessage } from '../../src/api/client';
import { INVITES_QUERY_KEY, organizationsApi } from '../../src/api/organizations';
import { Badge } from '../../src/components/Badge';
import { Screen } from '../../src/components/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/StateView';
import { useTheme } from '../../src/theme/useTheme';
import { relativeTime } from '../../src/utils/format';

/**
 * Invites that have been sent and not yet accepted. Reached from the Account
 * tab only. Revoking is admin-only on the server.
 */
export default function InvitesScreen() {
  const { colors, type, space } = useTheme();
  const queryClient = useQueryClient();

  const account = useQuery({ queryKey: [ACCOUNT_QUERY_KEY], queryFn: accountApi.get });
  const orgId = account.data?.organization.id;

  const invites = useQuery({
    queryKey: [INVITES_QUERY_KEY, orgId],
    queryFn: () => organizationsApi.invites(orgId!),
    enabled: !!orgId,
  });

  const me = account.data?.user;
  const isAdmin =
    me?.is_platform_admin || me?.role_name === 'admin' || me?.role_name === 'owner';

  const revoke = useMutation({
    mutationFn: (email: string) => organizationsApi.revokeInvite(orgId!, email),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [INVITES_QUERY_KEY] }),
    onError: (err) => Alert.alert('Invites', apiErrorMessage(err, 'Could not revoke the invite')),
  });

  if (account.isLoading || invites.isLoading) return <LoadingState label="Loading invites" />;
  if (invites.error || !invites.data) {
    return (
      <ErrorState
        message={apiErrorMessage(invites.error, 'Could not load invites')}
        onRetry={() => void invites.refetch()}
      />
    );
  }

  return (
    <Screen edgeToEdge>
      <FlatList
        data={invites.data}
        keyExtractor={(invite) => invite.email}
        ItemSeparatorComponent={() => (
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.sep }} />
        )}
        ListEmptyComponent={
          <EmptyState title="No pending invites" hint="Everyone you invited has joined." />
        }
        contentContainerStyle={invites.data.length === 0 ? styles.grow : undefined}
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
              <Text style={[type.body, { color: colors.label }]} numberOfLines={1}>
                {item.email}
              </Text>
              <Text style={[type.caption, { color: colors.label2 }]}>
                {item.created_at ? `Invited ${relativeTime(item.created_at)}` : 'Invited'}
                {item.expires_at ? ` · expires ${relativeTime(item.expires_at)}` : ''}
              </Text>
            </View>

            <View style={styles.meta}>
              <Badge label={String(item.role)} tone="info" />
              {isAdmin ? (
                <Pressable
                  onPress={() =>
                    Alert.alert('Revoke this invite?', `${item.email} will not be able to join.`, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Revoke',
                        style: 'destructive',
                        onPress: () => revoke.mutate(item.email),
                      },
                    ])
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Revoke the invite for ${item.email}`}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                >
                  <Text style={[type.caption, { color: colors.red, fontWeight: '600' }]}>
                    Revoke
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  meta: { alignItems: 'flex-end', gap: 6, marginLeft: 8 },
  grow: { flexGrow: 1 },
});
