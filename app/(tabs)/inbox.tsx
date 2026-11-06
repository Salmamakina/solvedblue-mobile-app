import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { apiErrorMessage } from '../../src/api/client';
import {
  INBOX_FOLDERS,
  INBOX_QUERY_KEY,
  inboxApi,
  type InboxFolder,
  type InboxThread,
} from '../../src/api/inbox';
import { Badge } from '../../src/components/Badge';
import { Refresh } from '../../src/components/Refresh';
import { Screen } from '../../src/components/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/StateView';
import { useTheme } from '../../src/theme/useTheme';
import { shortTime, threadTitle } from '../../src/utils/format';

export default function InboxScreen() {
  const { colors, type, space, radius } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [folder, setFolder] = useState<InboxFolder>('needs_reply');

  const { data, isLoading, isRefetching, error, refetch } = useQuery({
    queryKey: [INBOX_QUERY_KEY, folder],
    queryFn: () => inboxApi.list({ folder }),
  });

  function openThread(thread: InboxThread) {
    // Clearing the unread flag here keeps the badge honest without a round trip first.
    if (thread.unread) {
      void inboxApi.read(thread.contact).then(() => {
        void queryClient.invalidateQueries({ queryKey: [INBOX_QUERY_KEY] });
        void queryClient.invalidateQueries({ queryKey: ['inbox-badge'] });
      });
    }
    router.push({
      pathname: '/chat/[phone]',
      params: {
        phone: thread.phone_number,
        name: threadTitle(thread.display_name, thread.phone_number),
      },
    });
  }

  return (
    <Screen>
      <View style={[styles.folders, { paddingHorizontal: space.lg, paddingVertical: space.md }]}>
        {INBOX_FOLDERS.map(({ key, label }) => {
          const active = key === folder;
          const count = data?.counts?.[key];
          return (
            <Pressable
              key={key}
              onPress={() => setFolder(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={{
                backgroundColor: active ? colors.blue : colors.fill,
                borderRadius: radius.pill,
                paddingHorizontal: space.md,
                paddingVertical: space.sm,
              }}
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
          refreshControl={<Refresh refreshing={isRefetching} onRefresh={refetch} />}
          ItemSeparatorComponent={() => (
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.sep }} />
          )}
          ListEmptyComponent={
            <EmptyState
              title="Nothing here"
              hint={
                folder === 'needs_reply'
                  ? 'Every conversation has had a reply.'
                  : 'No conversations in this folder.'
              }
            />
          }
          contentContainerStyle={(data?.threads?.length ?? 0) === 0 ? styles.grow : undefined}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openThread(item)}
              accessibilityRole="button"
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
                  {item.unread ? (
                    <View style={[styles.dot, { backgroundColor: colors.blue }]} />
                  ) : null}
                  <Text
                    style={[
                      type.headline,
                      { color: colors.label, fontWeight: item.unread ? '700' : '600' },
                    ]}
                    numberOfLines={1}
                  >
                    {threadTitle(item.display_name, item.phone_number)}
                  </Text>
                </View>
                <Text style={[type.footnote, { color: colors.label2 }]} numberOfLines={1}>
                  {item.last_direction === 'out' ? 'You: ' : ''}
                  {item.last_text ?? 'No messages yet'}
                </Text>
                <View style={[styles.tagRow, { marginTop: space.xs }]}>
                  {item.tag === 'opted_out' ? <Badge label="Opted out" tone="bad" /> : null}
                  {item.flagged ? <Badge label="Flagged" tone="warn" /> : null}
                  {item.line_name ? <Badge label={item.line_name} /> : null}
                </View>
              </View>
              <Text style={[type.caption, { color: colors.label2, marginLeft: space.sm }]}>
                {shortTime(item.last_at)}
              </Text>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  folders: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  thread: { flexDirection: 'row', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tagRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  grow: { flexGrow: 1 },
});
