import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  CONTACTS_QUERY_KEY,
  contactName,
  contactsApi,
  isOptedOutError,
  isSendableAddress,
  OPTED_OUT_MESSAGE,
  type ContactRow,
} from '../../src/api/contacts';
import { HOME_QUERY_KEY, homeApi } from '../../src/api/home';
import { INBOX_BADGE_QUERY_KEY, INBOX_QUERY_KEY } from '../../src/api/inbox';
import { messagesApi, sendFailureText } from '../../src/api/messages';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { useDebounced } from '../../src/components/useDebounced';
import { useTheme } from '../../src/theme/useTheme';
import { prettyPhone } from '../../src/utils/format';
import { sendBlock } from '../../src/utils/home';

/** How many matching contacts to offer while typing. */
const SUGGESTIONS = 5;
/** The server's own cap for one message. */
const MAX_MESSAGE = 1_600;

const contactAddress = (contact: ContactRow) => contact.phone ?? contact.email ?? '';

/**
 * "Sends at 9:00 AM", with "tomorrow" or the weekday when it is not today.
 * Ported from `describeSendTime` in
 * spyder-web/src/pages/inbox/NewMessageDialog.tsx.
 */
export function describeSendTime(iso: string, now: Date = new Date()): string {
  const when = new Date(iso);
  const time = when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(when) - startOfDay(now)) / 86_400_000);
  if (days <= 0) return `Sends at ${time}`;
  if (days === 1) return `Sends at ${time} tomorrow`;
  return `Sends at ${time} on ${when.toLocaleDateString(undefined, { weekday: 'long' })}`;
}

/**
 * A first message to one person, ported from the web's NewMessageDialog: pick a
 * contact or type a number or an email, write it, send it.
 *
 * Presented as a sheet from the Inbox, because starting a conversation belongs
 * to the inbox as a whole rather than to whichever folder is showing.
 *
 * Three things are checked before the send rather than reported after it, since
 * all three would otherwise look like the message silently vanishing:
 * the address has opted out (`/contacts/send-preview`), sending is not set up
 * yet (no plan or no line, the same reason Home's setup card gives), and a
 * first message to a new contact is held until quiet hours end.
 */
export default function NewMessageScreen() {
  const { colors, type, space, radius } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [to, setTo] = useState('');
  const [text, setText] = useState('');
  // Set when a suggestion was tapped, so the list does not reopen over the
  // address that was just chosen from it.
  const [picked, setPicked] = useState(false);
  const [serverOptedOut, setServerOptedOut] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const address = to.trim();
  const settledAddress = useDebounced(address);
  const valid = isSendableAddress(address);
  // The debounced value lags the field by a keystroke or two. Anything derived
  // from the server's answer is only shown once it has caught up, otherwise the
  // warning on screen belongs to an address no longer in the box.
  const current = settledAddress === address;

  // Sending needs a plan and a line. Shared cache with Home, so usually in hand.
  const home = useQuery({ queryKey: [HOME_QUERY_KEY], queryFn: homeApi.summary });
  const block = home.data ? sendBlock(home.data.setup) : null;

  const matches = useQuery({
    queryKey: ['contact-picker', settledAddress],
    queryFn: () => contactsApi.list({ q: settledAddress, limit: SUGGESTIONS }),
    enabled: settledAddress.length >= 2 && !picked,
    placeholderData: (previous) => previous,
  });
  const suggestions = !picked && current ? matches.data?.contacts ?? [] : [];

  const preview = useQuery({
    queryKey: ['send-preview', settledAddress],
    queryFn: () => contactsApi.sendPreview(settledAddress),
    enabled: isSendableAddress(settledAddress),
    staleTime: 15_000,
  });
  const checked = valid && current ? preview.data : undefined;
  const optedOut = checked?.opted_out === true || serverOptedOut;
  const timing =
    checked && !checked.opted_out && checked.quiet_until
      ? describeSendTime(checked.quiet_until)
      : null;

  const send = useMutation({
    mutationFn: () =>
      messagesApi.sendMessage({
        phoneNumber: address,
        messageText: text.trim(),
        source: 'new_message',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [INBOX_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: [INBOX_BADGE_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: [CONTACTS_QUERY_KEY] });
      // Into the conversation rather than back to the list: the message just
      // sent is the thing to look at, and the list would need a refetch before
      // it even showed the new thread.
      router.replace({
        pathname: '/chat/[phone]',
        params: { phone: address, name: prettyPhone(address) },
      });
    },
    onError: (error: unknown) => {
      if (isOptedOutError(error)) setServerOptedOut(true);
      else setSendError(sendFailureText(error));
    },
  });

  const canSend = valid && text.trim().length > 0 && !block && !optedOut && !send.isPending;

  function changeTo(value: string) {
    setTo(value);
    setPicked(false);
    setServerOptedOut(false);
    setSendError(null);
  }

  function pick(contact: ContactRow) {
    setTo(contactAddress(contact));
    setPicked(true);
    setServerOptedOut(false);
    setSendError(null);
  }

  const fieldStyle = {
    backgroundColor: colors.bg2,
    borderColor: colors.sep,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    color: colors.label,
    padding: space.md,
    fontSize: 15,
  };

  return (
    <Screen edgeToEdge>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: space.lg, gap: space.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[type.footnote, { color: colors.label2 }]}>
            Start a conversation with a contact or a new number. It will appear in your Inbox.
          </Text>

          <View style={{ gap: space.sm }}>
            <Text style={[type.footnote, { color: colors.label2 }]}>To</Text>
            <TextInput
              value={to}
              onChangeText={changeTo}
              placeholder="Search contacts, or type a number or email"
              placeholderTextColor={colors.label2}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              accessibilityLabel="To"
              style={[fieldStyle, { minHeight: 44 }]}
            />

            {suggestions.length > 0 ? (
              <View
                accessibilityRole="list"
                accessibilityLabel="Matching contacts"
                style={{
                  backgroundColor: colors.bg2,
                  borderColor: colors.sep,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderRadius: radius.md,
                  overflow: 'hidden',
                }}
              >
                {suggestions.map((contact, index) => {
                  const name = contactName(contact);
                  const shown = contactAddress(contact);
                  return (
                    <Pressable
                      key={contact.id}
                      onPress={() => pick(contact)}
                      accessibilityRole="button"
                      accessibilityLabel={`${name}${contact.opted_out ? ', opted out' : ''}`}
                      style={({ pressed }) => [
                        styles.suggestion,
                        {
                          backgroundColor: pressed ? colors.fill2 : colors.bg2,
                          paddingHorizontal: space.md,
                          paddingVertical: space.md,
                          borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                          borderTopColor: colors.sep,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[type.body, { color: colors.label, fontWeight: '600' }]}
                          numberOfLines={1}
                        >
                          {name}
                        </Text>
                        {shown !== name ? (
                          <Text style={[type.caption, { color: colors.label2 }]} numberOfLines={1}>
                            {prettyPhone(shown)}
                          </Text>
                        ) : null}
                      </View>
                      {/* Offered, not hidden: picking an opted-out contact and
                          being told why is clearer than the name not appearing
                          and looking like the contact does not exist. */}
                      {contact.opted_out ? <Badge label="Opted out" tone="bad" /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>

          <View style={{ gap: space.sm }}>
            <Text style={[type.footnote, { color: colors.label2 }]}>Message</Text>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Write your message"
              placeholderTextColor={colors.label2}
              multiline
              maxLength={MAX_MESSAGE}
              accessibilityLabel="Message"
              style={[fieldStyle, { minHeight: 120, textAlignVertical: 'top' }]}
            />
          </View>

          {optedOut ? (
            <Text accessibilityRole="alert" style={[type.footnote, { color: colors.red }]}>
              {OPTED_OUT_MESSAGE}, so messages to them are blocked.
            </Text>
          ) : null}

          {sendError ? (
            <Text accessibilityRole="alert" style={[type.footnote, { color: colors.red }]}>
              {sendError}
            </Text>
          ) : null}

          {/* Quiet hours: a first message to a new contact waits, so say when
              rather than letting it look like it never went. */}
          {timing ? (
            <Text style={[type.footnote, { color: colors.label2 }]}>{timing}</Text>
          ) : null}

          {block ? (
            <View style={{ gap: space.xs }}>
              <Text style={[type.footnote, { color: colors.orange }]}>
                Sending isn&apos;t set up yet.
              </Text>
              {block.to ? (
                <Text
                  accessibilityRole="link"
                  onPress={() => router.replace(block.to as never)}
                  style={[type.footnote, { color: colors.blue, fontWeight: '600' }]}
                >
                  {block.todo}
                </Text>
              ) : (
                <Text style={[type.footnote, { color: colors.label2 }]}>{block.todo}</Text>
              )}
            </View>
          ) : null}
        </ScrollView>

        <View
          style={[
            styles.actions,
            { backgroundColor: colors.bg2, borderTopColor: colors.sep, padding: space.lg },
          ]}
        >
          <Button
            label="Cancel"
            variant="secondary"
            onPress={() => router.back()}
            style={styles.action}
          />
          <Button
            label="Send"
            onPress={() => send.mutate()}
            disabled={!canSend}
            loading={send.isPending}
            style={styles.action}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actions: { flexDirection: 'row', gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  action: { flex: 1 },
});
