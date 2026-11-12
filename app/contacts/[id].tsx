import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { apiErrorMessage } from '../../src/api/client';
import {
  CONTACTS_QUERY_KEY,
  contactName,
  contactsApi,
  OPTED_OUT_MESSAGE,
  type ContactRow,
} from '../../src/api/contacts';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Field } from '../../src/components/Field';
import { Screen } from '../../src/components/Screen';
import { ErrorState, LoadingState } from '../../src/components/StateView';
import { useTheme } from '../../src/theme/useTheme';
import { prettyPhone, relativeTime, shortTime } from '../../src/utils/format';

/**
 * One contact: who they are, and the handful of things about them a customer
 * can change. The server only accepts a name, tags and the flag
 * (PATCH /contacts/:id), so those are what this offers; a phone number or email
 * is the contact's identity and changing it would be a different contact.
 *
 * This is also where a contact with no phone number finally goes somewhere. On
 * the list such a row had nothing to open, because the only destination was a
 * conversation and there is no number to hold one on.
 */
export default function ContactScreen() {
  const { colors, type, space } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const contact = useQuery({
    queryKey: [CONTACTS_QUERY_KEY, id],
    queryFn: () => contactsApi.get(id),
    enabled: Boolean(id),
  });

  if (contact.isLoading) {
    return (
      <Screen>
        <LoadingState label="Loading contact" />
      </Screen>
    );
  }
  if (contact.error || !contact.data) {
    return (
      <Screen>
        <ErrorState
          message={apiErrorMessage(contact.error, 'Could not load that contact')}
          onRetry={() => void contact.refetch()}
        />
      </Screen>
    );
  }

  const row = contact.data;

  function openConversation() {
    if (!row.phone) return;
    router.push({
      pathname: '/chat/[phone]',
      params: { phone: row.phone, name: contactName(row) },
    });
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <Card>
          <View style={{ gap: space.sm }}>
            <Text style={[type.title, { color: colors.label }]}>{contactName(row)}</Text>

            {row.phone ? (
              <Text style={[type.body, { color: colors.label2 }]}>{prettyPhone(row.phone)}</Text>
            ) : null}
            {row.email ? <Text style={[type.body, { color: colors.label2 }]}>{row.email}</Text> : null}

            <View style={styles.tags}>
              {row.opted_out ? <Badge label="Opted out" tone="bad" /> : null}
              {row.flagged ? <Badge label="Flagged" tone="warn" /> : null}
              <Badge label={sourceLabel(row.source)} />
            </View>

            <Text style={[type.caption, { color: colors.label2 }]}>
              Added {shortTime(row.created_at)}
              {row.last_message_at ? ` · last message ${relativeTime(row.last_message_at)}` : ''}
            </Text>
          </View>
        </Card>

        {/* The most likely reason for being on this screen, so it is above the
            editing rather than below it. */}
        {row.phone ? (
          <Button label="Open conversation" onPress={openConversation} />
        ) : (
          <Card>
            <Text style={[type.footnote, { color: colors.label2 }]}>
              This contact has an email address but no phone number, so there is no conversation to
              open.
            </Text>
          </Card>
        )}

        {row.opted_out ? (
          <Card style={{ backgroundColor: colors.redTint, borderColor: colors.red }}>
            <Text style={[type.footnote, { color: colors.label }]}>
              {OPTED_OUT_MESSAGE}. Nothing automated will be sent to them again.
            </Text>
          </Card>
        ) : null}

        <EditContact
          contact={row}
          onSaved={(saved) => {
            // Both the one row and every list that showed it.
            queryClient.setQueryData([CONTACTS_QUERY_KEY, id], saved);
            void queryClient.invalidateQueries({ queryKey: [CONTACTS_QUERY_KEY] });
          }}
        />

        {Object.keys(row.fields).length > 0 ? (
          <Card title="Imported fields">
            <View style={{ gap: space.sm }}>
              {Object.entries(row.fields).map(([key, value]) => (
                <View key={key} style={styles.between}>
                  <Text style={[type.footnote, { color: colors.label2 }]}>{key}</Text>
                  <Text
                    style={[type.footnote, { color: colors.label, flex: 1, textAlign: 'right' }]}
                    numberOfLines={2}
                  >
                    {value}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

/**
 * The editable part. Held in local state and saved on a button rather than
 * saved per keystroke: a name halfway through being typed is not a name, and a
 * PATCH per character would fight the query cache.
 *
 * The flag is the exception. It is a switch, so flipping it *is* the decision,
 * and waiting for a Save would make the control feel broken.
 */
function EditContact({
  contact,
  onSaved,
}: {
  contact: ContactRow;
  onSaved: (contact: ContactRow) => void;
}) {
  const { colors, type, space } = useTheme();
  const [firstName, setFirstName] = useState(contact.first_name ?? '');
  const [lastName, setLastName] = useState(contact.last_name ?? '');
  const [tags, setTags] = useState(contact.tags.join(', '));

  const save = useMutation({
    mutationFn: (patch: Parameters<typeof contactsApi.update>[1]) =>
      contactsApi.update(contact.id, patch),
    onSuccess: onSaved,
    onError: (err) => Alert.alert('Contact', apiErrorMessage(err, 'Could not save that change')),
  });

  const parsedTags = tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  const changed =
    firstName !== (contact.first_name ?? '') ||
    lastName !== (contact.last_name ?? '') ||
    parsedTags.join('\u0000') !== contact.tags.join('\u0000');

  return (
    <Card title="Details">
      <View style={{ gap: space.md }}>
        <Field label="First name" value={firstName} onChangeText={setFirstName} placeholder="Jane" />
        <Field label="Last name" value={lastName} onChangeText={setLastName} placeholder="Okafor" />
        <Field
          label="Tags"
          value={tags}
          onChangeText={setTags}
          placeholder="buyer, austin"
          hint="Separated by commas."
          autoCapitalize="none"
        />

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={[type.body, { color: colors.label, fontWeight: '600' }]}>Flagged</Text>
            <Text style={[type.caption, { color: colors.label2, marginTop: space.xs }]}>
              Shows up in the Flagged folder in the inbox.
            </Text>
          </View>
          <Switch
            value={contact.flagged}
            disabled={save.isPending}
            onValueChange={(flagged) => save.mutate({ flagged })}
            accessibilityLabel="Flagged"
            trackColor={{ true: colors.toggle, false: colors.fill }}
          />
        </View>

        <Button
          label="Save"
          onPress={() =>
            save.mutate({ first_name: firstName.trim(), last_name: lastName.trim(), tags: parsedTags })
          }
          disabled={!changed}
          loading={save.isPending}
        />
      </View>
    </Card>
  );
}

/** Where the contact came from, in words rather than the server's enum. */
function sourceLabel(source: ContactRow['source']): string {
  switch (source) {
    case 'manual':
      return 'Added by hand';
    case 'file':
      return 'From a file';
    case 'google_sheet':
      return 'From a sheet';
    case 'inbox':
      return 'From the inbox';
    case 'send':
      return 'From a message';
    case 'campaign':
      return 'From a campaign';
  }
}

const styles = StyleSheet.create({
  tags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  between: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
});
