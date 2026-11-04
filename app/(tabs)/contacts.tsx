import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiErrorMessage } from '../../src/api/client';
import {
  CONTACT_FILTERS,
  CONTACTS_QUERY_KEY,
  contactName,
  contactsApi,
  type ContactFilter,
} from '../../src/api/contacts';
import { Badge } from '../../src/components/Badge';
import { Refresh } from '../../src/components/Refresh';
import { Screen } from '../../src/components/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/StateView';
import { useTheme } from '../../src/theme/useTheme';
import { prettyPhone, shortTime } from '../../src/utils/format';

/** Mirrors the web Contacts list: filter chips, search, tap to the conversation. */
export default function ContactsScreen() {
  const { colors, type, space, radius } = useTheme();
  const router = useRouter();
  const [filter, setFilter] = useState<ContactFilter>('all');
  const [query, setQuery] = useState('');

  const { data, isLoading, isRefetching, error, refetch } = useQuery({
    queryKey: [CONTACTS_QUERY_KEY, filter, query],
    queryFn: () => contactsApi.list({ filter, q: query }),
  });

  return (
    <Screen>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, gap: space.md }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search name, phone or email"
          placeholderTextColor={colors.label2}
          autoCapitalize="none"
          accessibilityLabel="Search contacts"
          style={{
            backgroundColor: colors.bg2,
            borderColor: colors.sep,
            borderWidth: StyleSheet.hairlineWidth,
            borderRadius: radius.md,
            color: colors.label,
            padding: space.md,
            fontSize: 15,
            minHeight: 44,
          }}
        />
        <View style={styles.chips}>
          {CONTACT_FILTERS.map(({ key, label }) => {
            const active = key === filter;
            const count = data?.counts?.[key];
            return (
              <Pressable
                key={key}
                onPress={() => setFilter(key)}
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
      </View>

      {isLoading ? (
        <LoadingState label="Loading contacts" />
      ) : error ? (
        <ErrorState message={apiErrorMessage(error, 'Could not load contacts')} onRetry={refetch} />
      ) : (
        <FlatList
          data={data?.contacts ?? []}
          keyExtractor={(contact) => contact.id}
          style={{ marginTop: space.md }}
          refreshControl={<Refresh refreshing={isRefetching} onRefresh={refetch} />}
          ItemSeparatorComponent={() => (
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.sep }} />
          )}
          ListEmptyComponent={
            <EmptyState
              title="No contacts"
              hint={query ? 'Nothing matches that search.' : 'Import contacts on the web app.'}
            />
          }
          contentContainerStyle={(data?.contacts?.length ?? 0) === 0 ? styles.grow : undefined}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              disabled={!item.phone}
              onPress={() =>
                item.phone
                  ? router.push({
                      pathname: '/chat/[phone]',
                      params: { phone: item.phone, name: contactName(item) },
                    })
                  : undefined
              }
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: pressed ? colors.fill2 : colors.bg2,
                  paddingHorizontal: space.lg,
                  paddingVertical: space.md,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[type.headline, { color: colors.label }]} numberOfLines={1}>
                  {contactName(item)}
                </Text>
                <Text style={[type.caption, { color: colors.label2 }]} numberOfLines={1}>
                  {item.phone ? prettyPhone(item.phone) : item.email}
                  {item.last_message_at ? ` · ${shortTime(item.last_message_at)}` : ''}
                </Text>
              </View>
              <View style={styles.tagRow}>
                {item.opted_out ? <Badge label="Opted out" tone="bad" /> : null}
                {item.flagged ? <Badge label="Flagged" tone="warn" /> : null}
              </View>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  row: { flexDirection: 'row', alignItems: 'center' },
  tagRow: { flexDirection: 'row', gap: 6, marginLeft: 8 },
  grow: { flexGrow: 1 },
});
