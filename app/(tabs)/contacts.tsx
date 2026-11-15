import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { apiErrorMessage } from '../../src/api/client';
import { INBOX_QUERY_KEY } from '../../src/api/inbox';
import { sendFailureText } from '../../src/api/messages';
import {
  CONTACT_FILTERS,
  CONTACTS_QUERY_KEY,
  contactName,
  contactsApi,
  type ContactFilter,
  type ContactRow,
} from '../../src/api/contacts';
import { AppHeader } from '../../src/components/AppHeader';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { FilterChips } from '../../src/components/FilterChips';
import { Screen } from '../../src/components/Screen';
import { SearchField } from '../../src/components/SearchField';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/StateView';
import { useDebounced } from '../../src/components/useDebounced';
import { emojiSafe } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/useTheme';
import { listTime, prettyPhone } from '../../src/utils/format';

/** The server's cap for one quick-send message. */
const MAX_QUICK_MESSAGE = 1_600;

export default function ContactsScreen() {
  const { colors, type, space } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ContactFilter>('all');
  const [search, setSearch] = useState('');
  const query = useDebounced(search.trim());

  /**
   * The chosen contacts, kept as a Map of the whole row rather than a Set of
   * ids: a bulk action needs each contact's address and current flag, and a
   * row can scroll out of the page the list is holding.
   */
  const [selection, setSelection] = useState<Map<string, ContactRow>>(() => new Map());
  const [composing, setComposing] = useState(false);
  const selecting = selection.size > 0;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [CONTACTS_QUERY_KEY, filter, query],
    queryFn: () => contactsApi.list({ filter, q: query }),
    // The previous results stay while the next ones load, so the list does not
    // empty and flash a spinner on every pause in typing.
    placeholderData: (previous) => previous,
  });

  const contacts = data?.contacts ?? [];
  const selected = useMemo(() => Array.from(selection.values()), [selection]);
  const pageSelected = contacts.filter((contact) => selection.has(contact.id)).length;
  const allOnPage = contacts.length > 0 && pageSelected === contacts.length;

  const clearSelection = useCallback(() => setSelection(new Map()), []);

  /**
   * Android's back gesture leaves selection mode rather than the screen.
   *
   * Without this, back out of a selection would drop you out of Contacts
   * entirely, which is the wrong thing to lose — the selection is the thing you
   * were trying to abandon.
   */
  useEffect(() => {
    if (!selecting) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      clearSelection();
      // true: handled, so the navigator does not also act on it.
      return true;
    });
    return () => subscription.remove();
  }, [selecting, clearSelection]);

  function toggle(contact: ContactRow) {
    setSelection((current) => {
      const next = new Map(current);
      if (next.has(contact.id)) next.delete(contact.id);
      else next.set(contact.id, contact);
      return next;
    });
  }

  /**
   * Selects or clears every contact on this page, not every contact in the
   * organization. The web is explicit about the same limit, and it matters
   * here: "select all" over ten thousand contacts followed by a send is not
   * something to leave ambiguous.
   */
  function togglePage() {
    setSelection((current) => {
      const next = new Map(current);
      for (const contact of contacts) {
        if (allOnPage) next.delete(contact.id);
        else next.set(contact.id, contact);
      }
      return next;
    });
  }

  /**
   * Flags the selection. One request per contact, because /contacts/flag takes
   * a single address, so a partial failure is possible and is reported as
   * such: "4 of 6 flagged" is actionable, "something went wrong" is not.
   */
  const flagAll = useMutation({
    mutationFn: async (contactsToFlag: ContactRow[]) => {
      const results = await Promise.allSettled(
        contactsToFlag.map((contact) =>
          contactsApi.flag(contact.phone ?? contact.email ?? contact.contact_key, true)
        )
      );
      return results.filter((result) => result.status === 'rejected').length;
    },
    onSuccess: (failed) => {
      void queryClient.invalidateQueries({ queryKey: [CONTACTS_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: [INBOX_QUERY_KEY] });
      const total = selected.length;
      clearSelection();
      Alert.alert(
        'Flag',
        failed === 0
          ? `${total} ${total === 1 ? 'contact' : 'contacts'} flagged.`
          : `${total - failed} of ${total} flagged. ${failed} could not be.`
      );
    },
    onError: (err) => Alert.alert('Flag', apiErrorMessage(err, 'Could not flag those contacts')),
  });

  function confirmFlag() {
    const count = selected.length;
    Alert.alert(
      `Flag ${count} ${count === 1 ? 'contact' : 'contacts'}?`,
      'Flagged contacts show a marker in Contacts and in the Inbox.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Flag', onPress: () => flagAll.mutate(selected) },
      ]
    );
  }

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
            // Outside selection mode this opens the contact rather than the
            // conversation. The conversation is one button away there, and this
            // way a contact with only an email address is reachable at all:
            // such a row used to be disabled, so tapping it did nothing.
            <Pressable
              accessibilityRole={selecting ? 'checkbox' : 'button'}
              accessibilityLabel={contactName(item)}
              accessibilityState={selecting ? { checked: selection.has(item.id) } : undefined}
              accessibilityHint={selecting ? undefined : 'Long press to select'}
              onPress={() =>
                selecting
                  ? toggle(item)
                  : router.push({ pathname: '/contacts/[id]', params: { id: item.id } })
              }
              // Long press is how selection starts, which is the convention on
              // both platforms, and it selects the row pressed rather than
              // opening an empty selection.
              onLongPress={() => toggle(item)}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: selection.has(item.id)
                    ? colors.blueTint
                    : pressed
                      ? colors.fill2
                      : colors.bg2,
                  paddingHorizontal: space.lg,
                  paddingVertical: space.md,
                },
              ]}
            >
              {selecting ? (
                <Ionicons
                  name={selection.has(item.id) ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={selection.has(item.id) ? colors.blue : colors.label2}
                  style={{ marginRight: space.md, marginTop: 2 }}
                  accessible={false}
                />
              ) : null}
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

      {/* The action bar exists only while something is chosen, so the list is
          not permanently shorter for a mode most visits never enter. */}
      {selecting ? (
        <View
          style={[
            styles.bar,
            {
              backgroundColor: colors.bg2,
              borderTopColor: colors.sep,
              paddingHorizontal: space.lg,
              paddingVertical: space.md,
              gap: space.md,
            },
          ]}
        >
          <View style={styles.barTop}>
            <Text style={[type.footnote, { color: colors.label, fontWeight: '600' }]}>
              {selection.size} selected
            </Text>
            <Pressable
              onPress={togglePage}
              accessibilityRole="button"
              accessibilityLabel={
                allOnPage ? 'Clear the contacts on this page' : 'Select all contacts on this page'
              }
              hitSlop={space.sm}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginLeft: space.md })}
            >
              <Text style={[type.footnote, { color: colors.blue, fontWeight: '600' }]}>
                {allOnPage ? 'Clear page' : 'Select page'}
              </Text>
            </Pressable>
            <Pressable
              onPress={clearSelection}
              accessibilityRole="button"
              accessibilityLabel="Cancel selection"
              hitSlop={space.sm}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginLeft: 'auto' })}
            >
              <Text style={[type.footnote, { color: colors.label2 }]}>Cancel</Text>
            </Pressable>
          </View>

          <View style={styles.actions}>
            <Button
              label="Flag"
              variant="secondary"
              onPress={confirmFlag}
              loading={flagAll.isPending}
              style={styles.action}
            />
            <Button
              label="Send a message"
              onPress={() => setComposing(true)}
              style={styles.action}
            />
          </View>

          {/* Deleting is deliberately absent. The backend has no route for it:
              spyder-backend/src/routes/contacts.ts exposes no DELETE, and the
              web's Contacts page offers no delete either, for the same reason.
              It also needs a ruling first — erasing a contact must not erase
              their opt-out, or someone who replied STOP could be messaged
              again. Tracked in WEEKEND_ROADMAP.md. */}
        </View>
      ) : null}

      <SendToSelection
        open={composing}
        contacts={selected}
        onClose={() => setComposing(false)}
        onSent={() => {
          setComposing(false);
          clearSelection();
        }}
      />
    </Screen>
  );
}

/**
 * One message to every chosen contact, over POST /contacts/send, ported from
 * the web's SendDialog.
 *
 * The result names what it left out — contacts who opted out, and contacts with
 * an email but no phone number — and both are shown, because "sent to 40 of 50"
 * without a reason is the kind of thing that gets investigated twice.
 */
function SendToSelection({
  open,
  contacts,
  onClose,
  onSent,
}: {
  open: boolean;
  contacts: ContactRow[];
  onClose: () => void;
  onSent: () => void;
}) {
  const { colors, type, space, radius } = useTheme();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');

  const send = useMutation({
    mutationFn: () => contactsApi.send(contacts.map((contact) => contact.id), text.trim()),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: [CONTACTS_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: [INBOX_QUERY_KEY] });
      const skipped = [
        result.skipped_opted_out > 0 ? `${result.skipped_opted_out} opted out` : null,
        result.skipped_no_phone > 0 ? `${result.skipped_no_phone} with no phone number` : null,
      ].filter(Boolean);
      setText('');
      onSent();
      Alert.alert(
        'Message queued',
        `Sending to ${result.recipients} ${result.recipients === 1 ? 'contact' : 'contacts'}.${
          skipped.length > 0 ? ` Skipped ${skipped.join(' and ')}.` : ''
        }`
      );
    },
    onError: (err) => Alert.alert('Send', sendFailureText(err)),
  });

  const count = contacts.length;
  const canSend = text.trim().length > 0 && count > 0 && !send.isPending;

  function confirm() {
    Alert.alert(
      `Send to ${count} ${count === 1 ? 'contact' : 'contacts'}?`,
      'Anyone who has opted out is skipped automatically.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', onPress: () => send.mutate() },
      ]
    );
  }

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={onClose}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}
      >
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.bg,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              padding: space.lg,
              gap: space.md,
            },
          ]}
        >
          <Text style={[type.section, { color: colors.label }]}>
            Message {count} {count === 1 ? 'contact' : 'contacts'}
          </Text>
          <Text style={[type.footnote, { color: colors.label2 }]}>
            One message, sent to each of them separately. Replies land in your Inbox.
          </Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Write your message"
            placeholderTextColor={colors.label2}
            multiline
            maxLength={MAX_QUICK_MESSAGE}
            autoFocus
            accessibilityLabel="Message"
            style={[
              emojiSafe(type.body),
              {
                backgroundColor: colors.bg2,
                borderColor: colors.sep,
                borderWidth: StyleSheet.hairlineWidth,
                borderRadius: radius.md,
                color: colors.label,
                padding: space.md,
                minHeight: 110,
                textAlignVertical: 'top',
              },
            ]}
          />
          <View style={styles.actions}>
            <Button label="Cancel" variant="secondary" onPress={onClose} style={styles.action} />
            <Button
              label="Send"
              onPress={confirm}
              disabled={!canSend}
              loading={send.isPending}
              style={styles.action}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  tagRow: { alignItems: 'flex-end', gap: 4 },
  grow: { flexGrow: 1 },
  bar: { borderTopWidth: StyleSheet.hairlineWidth },
  barTop: { flexDirection: 'row', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { paddingBottom: 32 },
});
