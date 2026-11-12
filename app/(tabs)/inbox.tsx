import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { ACCOUNT_QUERY_KEY, accountApi } from '../../src/api/account';
import { apiErrorMessage } from '../../src/api/client';
import { contactsApi } from '../../src/api/contacts';
import {
  INBOX_BADGE_QUERY_KEY,
  INBOX_FOLDERS,
  INBOX_QUERY_KEY,
  inboxApi,
  type InboxFolder,
  type InboxThread,
} from '../../src/api/inbox';
import { AppHeader } from '../../src/components/AppHeader';
import { Badge } from '../../src/components/Badge';
import { Screen } from '../../src/components/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/StateView';
import { useAuthStore } from '../../src/stores/authStore';
import { useTheme } from '../../src/theme/useTheme';
import { shortTime, threadTitle } from '../../src/utils/format';

/**
 * The team inbox. One list, filtered by the same five folders the web and the
 * backend already agree on, with the actions that go with a conversation on a
 * long press.
 *
 * `all` is the folder it opens on, not `needs_reply`, because the tab badge
 * counts unread conversations across everything: opening on a narrower folder
 * would let you tap a badge and land on a list that does not contain the thread
 * it was counting.
 */
export default function InboxScreen() {
  const { colors, type, space, radius } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const myId = useAuthStore((s) => s.user?.id);
  const [folder, setFolder] = useState<InboxFolder>('all');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [INBOX_QUERY_KEY, folder],
    queryFn: () => inboxApi.list({ folder }),
  });

  // Assigning is a paid feature on the server, so the action is offered only
  // where the plan has it rather than shown and then rejected with a 403.
  // Shared cache with the Account tab, so this is usually already in hand.
  const account = useQuery({ queryKey: [ACCOUNT_QUERY_KEY], queryFn: accountApi.get });
  const canAssign = account.data?.entitlements.features.team_inbox === true;

  /** Both the list and the tab badge are derived from the same rows. */
  function refreshInbox() {
    void queryClient.invalidateQueries({ queryKey: [INBOX_QUERY_KEY] });
    void queryClient.invalidateQueries({ queryKey: [INBOX_BADGE_QUERY_KEY] });
  }

  const act = useMutation({
    mutationFn: (job: { thread: InboxThread; action: ThreadAction }) => runAction(job.thread, job.action, myId),
    onSuccess: refreshInbox,
    onError: (err) => Alert.alert('Inbox', apiErrorMessage(err, 'Could not do that')),
  });

  function openThread(thread: InboxThread) {
    // Clearing the unread flag here keeps the badge honest without a round trip first.
    if (thread.unread) {
      void inboxApi.read(thread.contact).then(refreshInbox);
    }
    router.push({
      pathname: '/chat/[phone]',
      params: {
        phone: thread.phone_number,
        name: threadTitle(thread.display_name, thread.phone_number),
      },
    });
  }

  /**
   * A long press offers what you can do to the conversation. An action sheet
   * built from Alert rather than ActionSheetIOS, which is iOS only, or a custom
   * row of buttons, which would crowd a list whose job is to be scanned.
   */
  function openActions(thread: InboxThread) {
    const title = threadTitle(thread.display_name, thread.phone_number);
    const actions: { label: string; action: ThreadAction; destructive?: boolean }[] = [
      thread.closed
        ? { label: 'Reopen', action: 'reopen' }
        : { label: 'Close', action: 'close', destructive: true },
      thread.flagged ? { label: 'Unflag', action: 'unflag' } : { label: 'Flag', action: 'flag' },
    ];
    if (canAssign) {
      actions.push(
        thread.assigned_user_id === myId && myId
          ? { label: 'Unassign', action: 'unassign' }
          : { label: 'Assign to me', action: 'assign' }
      );
    }

    Alert.alert(title, undefined, [
      ...actions.map(({ label, action, destructive }) => ({
        text: label,
        style: destructive ? ('destructive' as const) : ('default' as const),
        onPress: () => act.mutate({ thread, action }),
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <Screen>
      <AppHeader />

      {/* Folders above the list, each carrying the server's own count, so what
          is waiting is visible without opening each one. */}
      <View
        style={[styles.folders, { paddingHorizontal: space.lg, paddingTop: space.md }]}
      >
        {INBOX_FOLDERS.map(({ key, label }) => {
          const active = key === folder;
          const count = data?.counts?.[key];
          return (
            <Pressable
              key={key}
              onPress={() => setFolder(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={count ? `${label}, ${count}` : label}
              style={({ pressed }) => ({
                backgroundColor: active ? colors.blue : colors.fill,
                borderRadius: radius.pill,
                paddingHorizontal: space.md,
                paddingVertical: space.sm,
                opacity: pressed && !active ? 0.6 : 1,
              })}
            >
              <Text
                style={[
                  type.footnote,
                  { color: active ? '#FFFFFF' : colors.label2, fontWeight: '600' },
                ]}
              >
                {label}
                {count ? ` ${count}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <LoadingState label="Loading conversations" />
      ) : error ? (
        <ErrorState message={apiErrorMessage(error, 'Could not load the inbox')} onRetry={refetch} />
      ) : (
        <FlatList
          data={data?.threads ?? []}
          keyExtractor={(thread) => thread.contact}
          style={{ marginTop: space.md }}
          ItemSeparatorComponent={() => (
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.sep }} />
          )}
          ListEmptyComponent={<EmptyState title="Nothing here" hint={emptyHint(folder)} />}
          contentContainerStyle={(data?.threads?.length ?? 0) === 0 ? styles.grow : undefined}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openThread(item)}
              onLongPress={() => openActions(item)}
              accessibilityRole="button"
              // One spoken label for the row, so an unread conversation is
              // announced rather than relying on the colour of the dot.
              accessibilityLabel={`${threadTitle(item.display_name, item.phone_number)}${
                item.unread ? ', unread' : ''
              }${item.flagged ? ', flagged' : ''}${item.closed ? ', closed' : ''}`}
              accessibilityHint="Long press for actions"
              style={({ pressed }) => [
                styles.thread,
                {
                  backgroundColor: pressed ? colors.fill2 : colors.bg2,
                  paddingHorizontal: space.lg,
                  paddingVertical: space.md,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  {/* Unread is one red dot. The bold name used to double as a
                      second unread cue, which read as two separate marks. */}
                  {item.unread ? (
                    <View
                      style={[styles.dot, { backgroundColor: colors.red }]}
                      accessible={false}
                    />
                  ) : null}
                  <Text
                    style={[type.headline, { color: colors.label }]}
                    numberOfLines={1}
                  >
                    {threadTitle(item.display_name, item.phone_number)}
                  </Text>
                </View>
                <Text style={[type.footnote, { color: colors.label2 }]} numberOfLines={1}>
                  {item.last_direction === 'out' ? 'You: ' : ''}
                  {item.last_text ?? 'No messages yet'}
                </Text>
                {item.tag === 'opted_out' ? (
                  <View style={{ marginTop: space.xs }}>
                    <Badge label="Opted out" tone="bad" />
                  </View>
                ) : null}
              </View>

              {/* Flagged sits top-right, above the timestamp, rather than under
                  the name where it pushed the message text down. Assigned to
                  you is only worth a mark where the plan allows assigning. */}
              <View style={[styles.meta, { marginLeft: space.sm }]}>
                {item.flagged ? <Badge label="Flagged" tone="warn" /> : null}
                {canAssign && item.assigned_user_id && item.assigned_user_id === myId ? (
                  <Badge label="Yours" tone="info" />
                ) : null}
                <Text style={[type.caption, { color: colors.label2 }]}>
                  {shortTime(item.last_at)}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

type ThreadAction = 'close' | 'reopen' | 'flag' | 'unflag' | 'assign' | 'unassign';

/**
 * Runs one action against a conversation.
 *
 * Close, reopen and assign are keyed by `contact` (the normalised key the inbox
 * actions take); flagging belongs to the contact record and is keyed by the raw
 * address, which is what /contacts/flag expects.
 */
function runAction(thread: InboxThread, action: ThreadAction, myId: string | undefined): Promise<unknown> {
  switch (action) {
    case 'close':
      return inboxApi.close(thread.contact);
    case 'reopen':
      return inboxApi.reopen(thread.contact);
    case 'flag':
      return contactsApi.flag(thread.phone_number, true);
    case 'unflag':
      return contactsApi.flag(thread.phone_number, false);
    case 'assign':
      return inboxApi.assign(thread.contact, myId ?? null);
    case 'unassign':
      return inboxApi.assign(thread.contact, null);
  }
}

/** Why this folder is empty, which differs enough per folder to be worth saying. */
function emptyHint(folder: InboxFolder): string {
  switch (folder) {
    case 'needs_reply':
      return 'Nobody is waiting on a reply.';
    case 'mine':
      return 'Nothing is assigned to you.';
    case 'flagged':
      return 'No conversations are flagged.';
    case 'closed':
      return 'Nothing has been closed yet.';
    case 'all':
      return 'No conversations yet.';
  }
}

const styles = StyleSheet.create({
  folders: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  // alignItems flex-start, so the flagged badge and time sit at the row's top
  // edge rather than being centred against a two-line message.
  thread: { flexDirection: 'row', alignItems: 'flex-start' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { alignItems: 'flex-end', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  grow: { flexGrow: 1 },
});
