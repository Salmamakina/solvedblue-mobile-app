import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { apiErrorMessage } from '../../src/api/client';
import {
  CONTACT_FILTERS,
  CONTACTS_QUERY_KEY,
  contactName,
  contactsApi,
  type ContactFilter,
} from '../../src/api/contacts';
import { AppHeader } from '../../src/components/AppHeader';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { FilterChips } from '../../src/components/FilterChips';
import { Screen } from '../../src/components/Screen';
import { SearchField } from '../../src/components/SearchField';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/StateView';
import { useDebounced } from '../../src/components/useDebounced';
import { useTheme } from '../../src/theme/useTheme';
import { listTime, prettyPhone } from '../../src/utils/format';

export default function ContactsScreen() {
  const { colors, type, space } = useTheme();
  const router = useRouter();
  const [filter, setFilter] = useState<ContactFilter>('all');
  const [search, setSearch] = useState('');
  const query = useDebounced(search.trim());

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [CONTACTS_QUERY_KEY, filter, query],
    queryFn: () => contactsApi.list({ filter, q: query }),
    // The previous results stay while the next ones load, so the list does not
    // empty and flash a spinner on every pause in typing.
    placeholderData: (previous) => previous,
  });

  return (
    <Screen>
      <AppHeader />
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, gap: space.md }}>
        <View style={styles.actions}>
          <Button
            label="Add contact"
            onPress={() => router.push('/contacts/new')}
            style={styles.action}
          />
          <Button
            label="Import"
            variant="secondary"
            onPress={() => router.push('/contacts/import')}
            style={styles.action}
          />
        </View>
        <SearchField
          value={search}
          onChangeText={setSearch}
          label="Search contacts"
          placeholder="Search name, phone or email"
        />
      </View>

      {/* Same scrolling line as the Inbox folders, so the two lists filter the
          same way and a longer label never costs the list a row of height. */}
      <FilterChips
        chips={CONTACT_FILTERS}
        selected={filter}
        onSelect={setFilter}
        counts={data?.counts}
        label="Filters"
        style={{ flexGrow: 0, marginTop: space.md }}
      />

      {isLoading ? (
        <LoadingState label="Loading contacts" />
      ) : error ? (
        <ErrorState message={apiErrorMessage(error, 'Could not load contacts')} onRetry={refetch} />
      ) : (
        <FlatList
          data={data?.contacts ?? []}
          keyExtractor={(contact) => contact.id}
          style={{ marginTop: space.md }}
          ItemSeparatorComponent={() => (
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.sep }} />
          )}
          ListEmptyComponent={
            <EmptyState
              title="No contacts"
              hint={
                query
                  ? 'Nothing matches that search.'
                  : filter === 'all'
                    ? 'Add one by hand, or import a file or a Google Sheet.'
                    : `No contacts are ${filter === 'flagged' ? 'flagged' : 'opted out'}.`
              }
            />
          }
          contentContainerStyle={(data?.contacts?.length ?? 0) === 0 ? styles.grow : undefined}
          renderItem={({ item }) => (
            // Opens the contact rather than the conversation. The conversation
            // is one button away there, and this way a contact with only an
            // email address is reachable at all: such a row used to be
            // disabled, so tapping it did nothing.
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={contactName(item)}
              onPress={() => router.push({ pathname: '/contacts/[id]', params: { id: item.id } })}
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
                  {item.last_message_at ? ` · ${listTime(item.last_message_at)}` : ''}
                </Text>
              </View>
              {/* Top-right, so the labels line up with the name rather than
                  being centred against the row. */}
              <View style={[styles.tagRow, { marginLeft: space.sm }]}>
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
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  tagRow: { alignItems: 'flex-end', gap: 4 },
  grow: { flexGrow: 1 },
});
