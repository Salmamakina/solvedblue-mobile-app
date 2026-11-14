import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ACCOUNT_QUERY_KEY, accountApi } from '../../src/api/account';
import { apiErrorMessage } from '../../src/api/client';
import { contactsApi, CONTACTS_QUERY_KEY } from '../../src/api/contacts';
import {
  INBOX_BADGE_QUERY_KEY,
  INBOX_QUERY_KEY,
  INBOX_THREAD_QUERY_KEY,
  inboxApi,
  type InboxThread,
} from '../../src/api/inbox';
import { mediaApi } from '../../src/api/media';
import {
  CHAT_QUERY_KEY,
  messageAt,
  messageText,
  messagesApi,
  sendFailureText,
  type ChatMessage,
} from '../../src/api/messages';
import { MEMBERS_QUERY_KEY, organizationsApi } from '../../src/api/organizations';
import { Composer, type Attachment } from '../../src/components/Composer';
import { Menu, type MenuItem } from '../../src/components/Menu';
import { MessagePicture, MessageVoice } from '../../src/components/MessageMedia';
import { Screen } from '../../src/components/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/StateView';
import { useAuthStore } from '../../src/stores/authStore';
import { emojiSafe } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/useTheme';
import { prettyPhone, STAMP_GAP_MS, stampTime } from '../../src/utils/format';

/** A message sent as SMS rather than iMessage, which carries text only. */
const isText = (message: ChatMessage) => message.delivery_method !== 'imessage';

/**
 * What happened to a message we sent, as iMessage words it. Ported from
 * `receiptText` in spyder-web/src/pages/inbox/Thread.tsx.
 *
 * Every field this reads was already in the backend's chat response; the
 * mobile ChatMessage type simply did not declare them.
 */
function receiptText(message: ChatMessage): string | null {
  if (message.read_at) {
    return `Read ${new Date(message.read_at).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })}`;
  }
  if (message.delivered_at) return 'Delivered';
  if (message.status === 'sent') return 'Sent';
  return null;
}

export default function ChatScreen() {
  const { colors, type, space, radius } = useTheme();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ phone: string; name?: string }>();
  const phone = params.phone ?? '';
  const myId = useAuthStore((s) => s.user?.id);

  const [draft, setDraft] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [CHAT_QUERY_KEY, phone],
    queryFn: () => messagesApi.getChatMessages(phone),
    enabled: phone.length > 0,
    // No websocket on mobile yet, so poll while the thread is open.
    refetchInterval: 15_000,
  });

  /**
   * The conversation's own state — flagged, closed, opted out, assigned — which
   * is not in the messages. The screen can be opened from the inbox, from
   * Home's "Waiting on you" or straight after a first send, so it is looked up
   * rather than passed in: only the inbox would have had it to pass.
   */
  const thread = useQuery({
    queryKey: [INBOX_THREAD_QUERY_KEY, phone],
    queryFn: () => inboxApi.findByAddress(phone),
    enabled: phone.length > 0,
  });

  // Assigning is a paid feature on the server, so the control is offered only
  // where the plan has it rather than shown and then rejected with a 403.
  const account = useQuery({ queryKey: [ACCOUNT_QUERY_KEY], queryFn: accountApi.get });
  const canAssign = account.data?.entitlements.features.team_inbox === true;
  const orgId = account.data?.organization.id;

  const members = useQuery({
    queryKey: [MEMBERS_QUERY_KEY, orgId],
    queryFn: () => organizationsApi.members(orgId!),
    enabled: canAssign && !!orgId,
    staleTime: 60_000,
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [CHAT_QUERY_KEY, phone] });
    void queryClient.invalidateQueries({ queryKey: [INBOX_THREAD_QUERY_KEY, phone] });
    void queryClient.invalidateQueries({ queryKey: [INBOX_QUERY_KEY] });
    void queryClient.invalidateQueries({ queryKey: [INBOX_BADGE_QUERY_KEY] });
  }, [queryClient, phone]);

  /** Oldest first, so the newest sits at the bottom like every messaging app. */
  const messages = useMemo(
    () =>
      [...(data?.messages ?? [])].sort((a, b) =>
        (messageAt(a) ?? '').localeCompare(messageAt(b) ?? '')
      ),
    [data?.messages]
  );

  // The receipt belongs to the newest outgoing message only, which is what
  // iMessage does. On every bubble it is noise.
  const lastOutIndex = messages.map((message) => message.type).lastIndexOf('sent');
  const lastOut = lastOutIndex >= 0 ? messages[lastOutIndex] : undefined;
  // Which way a reply will go, and so whether attachments are possible: the
  // last thing we sent is the best evidence available.
  const viaText = !!lastOut && isText(lastOut);
  const optedOut = thread.data?.tag === 'opted_out';

  const send = useMutation({
    mutationFn: async () => {
      // The file first: a message that references a URL the server rejected
      // would be sent with a broken attachment.
      const media = attachment ? await mediaApi.upload(attachment) : null;
      return messagesApi.sendMessage({
        phoneNumber: phone,
        messageText: draft.trim(),
        ...(media ? { mediaUrl: media.url } : {}),
      });
    },
    onSuccess: () => {
      setDraft('');
      setAttachment(null);
      setSendError(null);
      refresh();
    },
    // The draft and the attachment are deliberately kept, so "try again" is
    // one tap rather than typing it out and picking the file again.
    onError: (err) => setSendError(sendFailureText(err)),
  });

  const retry = useMutation({
    mutationFn: (message: ChatMessage) =>
      messagesApi.sendMessage({
        phoneNumber: message.phone_number,
        messageText: message.message_text ?? '',
        ...(message.media_url ? { mediaUrl: message.media_url } : {}),
      }),
    onSuccess: refresh,
    onError: (err) => setSendError(sendFailureText(err)),
  });

  const act = useMutation({
    mutationFn: async (action: ThreadAction) => {
      const current = thread.data;
      if (!current) throw new Error('No conversation yet');
      return runAction(current, action);
    },
    onSuccess: () => {
      refresh();
      void queryClient.invalidateQueries({ queryKey: [CONTACTS_QUERY_KEY] });
    },
    onError: (err) => Alert.alert('Conversation', apiErrorMessage(err, 'Could not do that')),
  });

  const assign = useMutation({
    mutationFn: (userId: string | null) => inboxApi.assign(thread.data!.contact, userId),
    onSuccess: refresh,
    onError: (err) =>
      Alert.alert('Assign', apiErrorMessage(err, 'Could not assign this conversation')),
  });

  /** Opting out is the one action here that cannot be undone from the app. */
  const confirmOptOut = useCallback(() => {
    const name = params.name || prettyPhone(phone);
    Alert.alert(
      'Mark as opted out?',
      `${name} will be blocked from receiving messages, the same as if they had replied STOP. This cannot be undone from the app.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark as opted out', style: 'destructive', onPress: () => act.mutate('opt_out') },
      ]
    );
  }, [act, params.name, phone]);

  const current = thread.data;

  /** What the assign control says, as the web's AssignMenu labels it. */
  const assignLabel = (() => {
    if (!current?.assigned_user_id) return 'Assign';
    if (current.assigned_user_id === myId) return 'Assigned to you';
    const who = members.data?.find((member) => member.id === current.assigned_user_id);
    return `Assigned to ${who?.email ?? 'a teammate'}`;
  })();

  const settingsItems: MenuItem[] = current
    ? [
        {
          label: current.flagged ? 'Remove flag' : 'Flag conversation',
          icon: current.flagged ? 'flag' : 'flag-outline',
          onPress: () => act.mutate(current.flagged ? 'unflag' : 'flag'),
        },
        ...(optedOut
          ? []
          : [
              {
                label: 'Mark as opted out',
                icon: 'ban-outline' as const,
                destructive: true,
                onPress: confirmOptOut,
              },
            ]),
        {
          label: current.closed ? 'Reopen conversation' : 'Close conversation',
          icon: current.closed ? 'mail-open-outline' : 'checkmark-done-outline',
          onPress: () => act.mutate(current.closed ? 'reopen' : 'close'),
        },
      ]
    : [];

  const assignItems: MenuItem[] = [
    {
      label: 'Unassigned',
      onPress: () => assign.mutate(null),
      selected: !current?.assigned_user_id,
    },
    ...(members.data ?? []).map((member) => ({
      label: member.id === myId ? `${member.email} (you)` : member.email,
      onPress: () => assign.mutate(member.id),
      selected: current?.assigned_user_id === member.id,
    })),
  ];

  useLayoutEffect(() => {
    navigation.setOptions({
      title: params.name || prettyPhone(phone),
      // Both controls sit in headerRight. Icons rather than words, because the
      // assignee's email would push the title out of its own row.
      headerRight: () =>
        current ? (
          <View style={[styles.headerRight, { gap: space.xs }]}>
            {canAssign ? (
              <Menu items={assignItems} label={assignLabel}>
                {({ open }) => (
                  <View style={styles.headerButton}>
                    <Ionicons
                      name={current.assigned_user_id ? 'person' : 'person-add-outline'}
                      size={22}
                      color={open ? colors.label : colors.blue}
                    />
                  </View>
                )}
              </Menu>
            ) : null}
            <Menu items={settingsItems} label="Conversation settings">
              {({ open }) => (
                <View style={styles.headerButton}>
                  <Ionicons
                    name="ellipsis-horizontal-circle-outline"
                    size={24}
                    color={open ? colors.label : colors.blue}
                  />
                  {/* A dot, so a flagged conversation says so from the header
                      without the menu having to be opened. */}
                  {current.flagged ? (
                    <View
                      style={[styles.flagDot, { backgroundColor: colors.orange }]}
                      accessible={false}
                    />
                  ) : null}
                </View>
              )}
            </Menu>
          </View>
        ) : null,
    });
    // assignItems and settingsItems are rebuilt each render; the thread and the
    // members they are derived from are what actually change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    navigation,
    params.name,
    phone,
    current,
    canAssign,
    assignLabel,
    members.data,
    optedOut,
    colors,
    space.xs,
  ]);

  useEffect(() => {
    if (messages.length > 0) {
      // Let the rows lay out before scrolling, otherwise the offset is stale.
      const timer = setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50);
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  if (isLoading) return <LoadingState label="Loading conversation" />;
  if (error) {
    return (
      <ErrorState
        message={apiErrorMessage(error, 'Could not load the conversation')}
        onRetry={refetch}
      />
    );
  }

  return (
    <Screen edgeToEdge>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(message) => `${message.type}-${message.id}`}
          contentContainerStyle={[
            { padding: space.lg, gap: space.sm },
            messages.length === 0 ? styles.grow : undefined,
          ]}
          ListEmptyComponent={
            <EmptyState title="No messages yet" hint="Send the first one below." />
          }
          renderItem={({ item, index }) => {
            const mine = item.type === 'sent';
            const at = messageAt(item);
            const previous = index > 0 ? messageAt(messages[index - 1]) : undefined;
            // A stamp only where there is a real gap, as the web does, so a
            // back-and-forth exchange is not interleaved with timestamps.
            const showStamp =
              !!at &&
              (!previous ||
                new Date(at).getTime() - new Date(previous).getTime() > STAMP_GAP_MS);

            const failed = mine && item.status === 'failed';
            const waiting = mine && item.status === 'pending';
            const notes: string[] = [];
            if (mine && isText(item)) notes.push('Sent as text message');
            if (waiting) notes.push(item.error_note ?? 'Sending…');
            // Every failed message says so: an older one must not look sent.
            const receipt = index === lastOutIndex && !failed && !waiting ? receiptText(item) : null;
            if (receipt) notes.push(receipt);

            const text = messageText(item);
            const side = mine ? styles.mine : styles.theirs;

            return (
              <View style={{ gap: space.xs }}>
                {showStamp ? (
                  <Text
                    style={[type.caption, { color: colors.label2, textAlign: 'center' }]}
                  >
                    {stampTime(at)}
                  </Text>
                ) : null}

                {item.media_url && item.media_kind === 'image' ? (
                  <View style={side}>
                    <MessagePicture url={item.media_url} />
                  </View>
                ) : null}

                {item.media_url && item.media_kind === 'audio' ? (
                  <View style={side}>
                    <MessageVoice url={item.media_url} mine={mine} />
                  </View>
                ) : null}

                {text ? (
                  <View style={side}>
                    <View
                      style={{
                        backgroundColor: mine ? colors.blue : colors.bubbleIn,
                        borderRadius: radius.xl,
                        paddingHorizontal: space.md,
                        paddingVertical: space.sm,
                        maxWidth: '82%',
                        // A failed message must not look like one that went.
                        opacity: failed ? 0.6 : 1,
                      }}
                    >
                      {/* emojiSafe: this is what was actually sent, and the
                          ramp's body line height crops an emoji on Android. */}
                      <Text
                        style={[emojiSafe(type.body), { color: mine ? '#FFFFFF' : colors.label }]}
                      >
                        {text}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {/* Reactions a teammate or the contact put on this message.
                    They are emoji, and they were being dropped: the backend
                    has filled in `reactions` all along. */}
                {item.reactions && item.reactions.length > 0 ? (
                  <View style={[side, { gap: space.xs }]}>
                    {item.reactions.map((reaction) => (
                      <View
                        key={reaction.id}
                        style={[
                          styles.reaction,
                          {
                            backgroundColor: colors.fill,
                            borderColor: colors.bg2,
                            borderRadius: radius.pill,
                          },
                        ]}
                      >
                        <Text style={styles.reactionGlyph}>{reaction.reaction}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {notes.length > 0 || failed ? (
                  <View style={[side, { gap: space.xs }]}>
                    <Text style={[type.caption, { color: failed ? colors.red : colors.label2 }]}>
                      {notes.join(' · ')}
                      {failed
                        ? `${notes.length > 0 ? ' · ' : ''}${
                            item.error_note?.startsWith('Not delivered')
                              ? item.error_note
                              : `Not delivered${item.error_note ? `. ${item.error_note}` : ''}`
                          }`
                        : ''}
                    </Text>
                    {failed ? (
                      <Pressable
                        onPress={() => retry.mutate(item)}
                        disabled={retry.isPending}
                        accessibilityRole="button"
                        accessibilityLabel="Try sending again"
                        hitSlop={space.sm}
                        style={({ pressed }) => ({ opacity: retry.isPending ? 0.5 : pressed ? 0.6 : 1 })}
                      >
                        <Text style={[type.caption, { color: colors.blue, fontWeight: '600' }]}>
                          Try again
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          }}
        />

        {sendError ? (
          <Text
            accessibilityRole="alert"
            style={[
              type.footnote,
              { color: colors.red, paddingHorizontal: space.lg, paddingBottom: space.sm },
            ]}
          >
            {sendError}
          </Text>
        ) : null}

        <Composer
          value={draft}
          onChangeText={setDraft}
          attachment={attachment}
          onAttach={setAttachment}
          onSend={() => send.mutate()}
          sending={send.isPending}
          viaText={viaText}
          optedOut={optedOut}
          accessibilityLabel={`Message ${params.name || prettyPhone(phone)}`}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

type ThreadAction = 'close' | 'reopen' | 'flag' | 'unflag' | 'opt_out';

/**
 * One action against this conversation.
 *
 * Close and reopen are keyed by `contact`, the normalised key the inbox actions
 * take. Flagging and opting out belong to the contact record and are keyed by
 * the raw address, which is what /contacts/flag and /contacts/opt-out expect.
 */
function runAction(thread: InboxThread, action: ThreadAction): Promise<unknown> {
  switch (action) {
    case 'close':
      return inboxApi.close(thread.contact);
    case 'reopen':
      return inboxApi.reopen(thread.contact);
    case 'flag':
      return contactsApi.flag(thread.phone_number, true);
    case 'unflag':
      return contactsApi.flag(thread.phone_number, false);
    case 'opt_out':
      return contactsApi.optOut(thread.phone_number);
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  mine: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  theirs: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  headerButton: { minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  flagDot: { position: 'absolute', top: 3, right: 3, width: 8, height: 8, borderRadius: 4 },
  reaction: { paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1.5 },
  reactionGlyph: { fontSize: 14, lineHeight: 20 },
});
