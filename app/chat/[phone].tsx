import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { apiErrorMessage } from '../../src/api/client';
import { INBOX_QUERY_KEY } from '../../src/api/inbox';
import {
  CHAT_QUERY_KEY,
  messageAt,
  messageText,
  messagesApi,
  type ChatMessage,
} from '../../src/api/messages';
import { Screen } from '../../src/components/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/StateView';
import { useTheme } from '../../src/theme/useTheme';
import { prettyPhone, shortTime } from '../../src/utils/format';

/** The conversation. Mirrors the web chat: bubbles, delivery method, send box. */
export default function ChatScreen() {
  const { colors, type, space, radius } = useTheme();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ phone: string; name?: string }>();
  const phone = params.phone ?? '';

  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: params.name || prettyPhone(phone) });
  }, [navigation, params.name, phone]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [CHAT_QUERY_KEY, phone],
    queryFn: () => messagesApi.getChatMessages(phone),
    enabled: phone.length > 0,
    // No websocket on mobile yet, so poll while the thread is open.
    refetchInterval: 15_000,
  });

  /** Oldest first, so the newest sits at the bottom like every messaging app. */
  const messages = [...(data?.messages ?? [])].sort((a, b) => {
    const left = messageAt(a) ?? '';
    const right = messageAt(b) ?? '';
    return left.localeCompare(right);
  });

  const send = useMutation({
    mutationFn: (text: string) =>
      messagesApi.sendMessage({ phoneNumber: phone, messageText: text, source: 'new_message' }),
    onSuccess: () => {
      setDraft('');
      setSendError(null);
      void queryClient.invalidateQueries({ queryKey: [CHAT_QUERY_KEY, phone] });
      void queryClient.invalidateQueries({ queryKey: [INBOX_QUERY_KEY] });
    },
    onError: (err) => setSendError(apiErrorMessage(err, 'Could not send the message')),
  });

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

  const canSend = draft.trim().length > 0 && !send.isPending;

  return (
    <Screen edgeToEdge>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(message) => message.id}
          contentContainerStyle={[
            { padding: space.lg, gap: space.sm },
            messages.length === 0 ? styles.grow : undefined,
          ]}
          ListEmptyComponent={
            <EmptyState title="No messages yet" hint="Send the first one below." />
          }
          renderItem={({ item }) => {
            const mine = item.type === 'sent';
            return (
              <View style={[styles.bubbleRow, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
                <View
                  style={{
                    backgroundColor: mine ? colors.blue : colors.bubbleIn,
                    borderRadius: radius.xl,
                    paddingHorizontal: space.md,
                    paddingVertical: space.sm,
                    maxWidth: '82%',
                  }}
                >
                  <Text style={[type.body, { color: mine ? '#FFFFFF' : colors.label }]}>
                    {messageText(item)}
                  </Text>
                  <Text
                    style={[
                      type.caption,
                      {
                        color: mine ? 'rgba(255,255,255,0.75)' : colors.label2,
                        marginTop: space.xs,
                      },
                    ]}
                  >
                    {shortTime(messageAt(item))}
                    {item.delivery_method === 'sms' ? ' · SMS' : ''}
                    {item.status === 'failed' ? ' · failed' : ''}
                  </Text>
                </View>
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

        <View
          style={[
            styles.composer,
            {
              backgroundColor: colors.bg2,
              borderTopColor: colors.sep,
              padding: space.md,
            },
          ]}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message"
            placeholderTextColor={colors.label2}
            multiline
            accessibilityLabel="Message"
            style={{
              flex: 1,
              backgroundColor: colors.fill2,
              borderRadius: radius.xl,
              color: colors.label,
              paddingHorizontal: space.md,
              paddingVertical: space.sm,
              fontSize: 15,
              maxHeight: 120,
              minHeight: 40,
            }}
          />
          <Pressable
            onPress={() => send.mutate(draft.trim())}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Send"
            accessibilityState={{ disabled: !canSend, busy: send.isPending }}
            style={({ pressed }) => [
              styles.sendButton,
              {
                backgroundColor: colors.blue,
                borderRadius: radius.pill,
                opacity: !canSend ? 0.4 : pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text style={[type.headline, { color: '#FFFFFF' }]}>
              {send.isPending ? '…' : 'Send'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  bubbleRow: { flexDirection: 'row' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sendButton: {
    minHeight: 44,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
});
