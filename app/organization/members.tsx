import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { ACCOUNT_QUERY_KEY, accountApi } from '../../src/api/account';
import { apiErrorMessage } from '../../src/api/client';
import {
  MEMBERS_QUERY_KEY,
  MEMBER_ROLES,
  organizationsApi,
  roleLabel,
  type Member,
  type MemberRole,
} from '../../src/api/organizations';
import { Badge } from '../../src/components/Badge';
import { Screen } from '../../src/components/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/StateView';
import { useTheme } from '../../src/theme/useTheme';
import { relativeTime } from '../../src/utils/format';

/**
 * Every member of the organization. Reached from the Account tab only, which is
 * why it is not a tab of its own.
 *
 * Changing a role and removing someone are admin-only on the server, so those
 * controls appear only for an admin.
 */
export default function MembersScreen() {
  const { colors, type, space } = useTheme();
  const queryClient = useQueryClient();

  const account = useQuery({ queryKey: [ACCOUNT_QUERY_KEY], queryFn: accountApi.get });
  const orgId = account.data?.organization.id;

  const members = useQuery({
    queryKey: [MEMBERS_QUERY_KEY, orgId],
    queryFn: () => organizationsApi.members(orgId!),
    enabled: !!orgId,
  });

  const me = account.data?.user;
  const isAdmin =
    me?.is_platform_admin || me?.role_name === 'admin' || me?.role_name === 'owner';

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: MemberRole }) =>
      organizationsApi.changeRole(orgId!, userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [MEMBERS_QUERY_KEY] }),
    onError: (err) => Alert.alert('Members', apiErrorMessage(err, 'Could not change the role')),
  });

  const remove = useMutation({
    mutationFn: (userId: string) => organizationsApi.removeMember(orgId!, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [MEMBERS_QUERY_KEY] }),
    onError: (err) => Alert.alert('Members', apiErrorMessage(err, 'Could not remove them')),
  });

  if (account.isLoading || members.isLoading) return <LoadingState label="Loading members" />;
  if (members.error || !members.data) {
    return (
      <ErrorState
        message={apiErrorMessage(members.error, 'Could not load members')}
        onRetry={() => void members.refetch()}
      />
    );
  }

  function askRole(member: Member) {
    Alert.alert(
      member.email,
      'Choose a role.',
      [
        ...MEMBER_ROLES.map((role) => ({
          text: role.label,
          onPress: () => changeRole.mutate({ userId: member.id, role: role.key }),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  }

  function askRemove(member: Member) {
    Alert.alert(
      'Remove from the organization?',
      `${member.email} will lose access to this workspace.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(member.id) },
      ]
    );
  }

  return (
    <Screen edgeToEdge>
      <FlatList
        data={members.data}
        keyExtractor={(member) => member.id}
        ItemSeparatorComponent={() => (
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.sep }} />
        )}
        ListEmptyComponent={<EmptyState title="No members" />}
        contentContainerStyle={members.data.length === 0 ? styles.grow : undefined}
        renderItem={({ item }) => {
          const isMe = item.id === me?.id;
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
              <View style={{ flex: 1 }}>
                <Text style={[type.body, { color: colors.label }]} numberOfLines={1}>
                  {item.email}
                  {isMe ? ' (you)' : ''}
                </Text>
                <Text style={[type.caption, { color: colors.label2 }]}>
                  Joined {relativeTime(item.created_at)}
                </Text>
              </View>

              <View style={styles.meta}>
                <Badge label={roleLabel(item)} />
                {/* Nobody can change or remove themselves: an admin demoting
                    their own account could leave the org with no admin. */}
                {isAdmin && !isMe ? (
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => askRole(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Change role for ${item.email}`}
                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                    >
                      <Text style={[type.caption, { color: colors.blue, fontWeight: '600' }]}>
                        Role
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => askRemove(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${item.email}`}
                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                    >
                      <Text style={[type.caption, { color: colors.red, fontWeight: '600' }]}>
                        Remove
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  meta: { alignItems: 'flex-end', gap: 6, marginLeft: 8 },
  actions: { flexDirection: 'row', gap: 12 },
  grow: { flexGrow: 1 },
});
