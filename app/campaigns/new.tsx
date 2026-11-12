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
  View,
} from 'react-native';
import { CAMPAIGNS_QUERY_KEY, campaignsApi } from '../../src/api/campaigns';
import { apiErrorMessage } from '../../src/api/client';
import {
  CONTACTS_QUERY_KEY,
  contactName,
  contactsApi,
  type ContactRow,
} from '../../src/api/contacts';
import { WORKFLOWS_QUERY_KEY, workflowsApi } from '../../src/api/workflows';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Field } from '../../src/components/Field';
import { Screen } from '../../src/components/Screen';
import { ErrorState, LoadingState } from '../../src/components/StateView';
import { useTheme } from '../../src/theme/useTheme';
import { prettyPhone } from '../../src/utils/format';
import { describeSteps, stepsOf } from '../../src/utils/workflowSteps';

/** Contacts to choose from in one page; enough for a phone, and one request. */
const CONTACT_LIMIT = 100;

/**
 * Creates a campaign: name it, pick the workflow that does the sending, pick
 * who it goes to. The same order as the web's CampaignBuilder.
 *
 * Only published workflows can be used, which is what the backend requires, so
 * an org with none is sent to build one first rather than shown an empty picker.
 *
 * Saved as a draft. Starting it is a separate, deliberate action on the
 * campaign list, so nobody sends to a list of people by accident here.
 */
export default function NewCampaignScreen() {
  const { colors, type, space } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const workflows = useQuery({
    queryKey: [WORKFLOWS_QUERY_KEY],
    queryFn: workflowsApi.list,
  });

  const contacts = useQuery({
    queryKey: [CONTACTS_QUERY_KEY, 'campaign-picker'],
    queryFn: () => contactsApi.list({ filter: 'all', limit: CONTACT_LIMIT }),
  });

  // A campaign can only run a published workflow.
  const usable = (workflows.data ?? []).filter((workflow) => workflow.status === 'published');

  // Opted-out contacts are filtered out by the backend when sending anyway, so
  // offering them here would only create a list that silently shrinks.
  const available = (contacts.data?.contacts ?? []).filter((contact) => !contact.opted_out);

  const create = useMutation({
    mutationFn: () => {
      const recipients = available
        .filter((contact) => chosen.has(contact.id))
        .map((contact) => ({
          phone_number: contact.phone,
          email: contact.email,
          name: contactName(contact),
        }));
      return campaignsApi.create({ name: name.trim(), workflow_id: workflowId!, recipients });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [CAMPAIGNS_QUERY_KEY] });
      router.back();
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not create the campaign')),
  });

  if (workflows.isLoading || contacts.isLoading) {
    return <LoadingState label="Loading" />;
  }
  if (workflows.error) {
    return (
      <ErrorState
        message={apiErrorMessage(workflows.error, 'Could not load workflows')}
        onRetry={() => void workflows.refetch()}
      />
    );
  }

  const canCreate = name.trim().length > 0 && workflowId !== null && chosen.size > 0;

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
          <Card>
            <Field
              label="Campaign name"
              value={name}
              onChangeText={setName}
              placeholder="November follow-ups"
            />
          </Card>

          <Card title="Workflow">
            {usable.length === 0 ? (
              <View style={{ gap: space.md }}>
                <Text style={[type.footnote, { color: colors.label2 }]}>
                  A campaign sends the messages in a workflow, so you need one first.
                </Text>
                <Button
                  label="Create a workflow"
                  variant="secondary"
                  onPress={() => router.push('/workflows/new')}
                />
              </View>
            ) : (
              <View style={{ gap: space.sm }}>
                {usable.map((workflow) => {
                  const active = workflow.id === workflowId;
                  const parsed = stepsOf(workflow.definition);
                  return (
                    <Pressable
                      key={workflow.id}
                      onPress={() => setWorkflowId(workflow.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={workflow.name}
                      style={({ pressed }) => [
                        styles.option,
                        {
                          borderColor: active ? colors.blue : colors.sep,
                          backgroundColor: active ? colors.blueTint : 'transparent',
                          opacity: pressed && !active ? 0.6 : 1,
                        },
                      ]}
                    >
                      <Text style={[type.body, { color: colors.label, fontWeight: '600' }]}>
                        {workflow.name}
                      </Text>
                      <Text style={[type.caption, { color: colors.label2 }]}>
                        {parsed.fits ? describeSteps(parsed.steps) : 'Built on the web'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Card>

          <Card title={`Recipients${chosen.size > 0 ? ` · ${chosen.size}` : ''}`}>
            {available.length === 0 ? (
              <Text style={[type.footnote, { color: colors.label2 }]}>
                No contacts yet. Add or import some on the Contacts tab.
              </Text>
            ) : (
              <View style={{ gap: space.sm }}>
                <View style={styles.bulkRow}>
                  <Pressable
                    onPress={() => setChosen(new Set(available.map((c) => c.id)))}
                    accessibilityRole="button"
                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  >
                    <Text style={[type.footnote, { color: colors.blue }]}>Select all</Text>
                  </Pressable>
                  {chosen.size > 0 ? (
                    <Pressable
                      onPress={() => setChosen(new Set())}
                      accessibilityRole="button"
                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                    >
                      <Text style={[type.footnote, { color: colors.label2 }]}>Clear</Text>
                    </Pressable>
                  ) : null}
                </View>

                {available.map((contact) => (
                  <ContactPick
                    key={contact.id}
                    contact={contact}
                    selected={chosen.has(contact.id)}
                    onToggle={() =>
                      setChosen((current) => {
                        const next = new Set(current);
                        if (next.has(contact.id)) next.delete(contact.id);
                        else next.add(contact.id);
                        return next;
                      })
                    }
                  />
                ))}

                {(contacts.data?.pagination.total ?? 0) > available.length ? (
                  <Text style={[type.caption, { color: colors.label2 }]}>
                    Showing the first {available.length}. Build a larger campaign on the web.
                  </Text>
                ) : null}
              </View>
            )}
          </Card>

          {error ? (
            <Text accessibilityRole="alert" style={[type.footnote, { color: colors.red }]}>
              {error}
            </Text>
          ) : null}

          <Button
            label="Create campaign"
            onPress={() => create.mutate()}
            disabled={!canCreate}
            loading={create.isPending}
          />
          <Text style={[type.caption, { color: colors.label2, textAlign: 'center' }]}>
            Saved as a draft. Nothing sends until you start it.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function ContactPick({
  contact,
  selected,
  onToggle,
}: {
  contact: ContactRow;
  selected: boolean;
  onToggle: () => void;
}) {
  const { colors, type, space } = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={contactName(contact)}
      style={({ pressed }) => [styles.pick, { opacity: pressed ? 0.6 : 1 }]}
    >
      <View
        style={[
          styles.box,
          {
            borderColor: selected ? colors.blue : colors.label2,
            backgroundColor: selected ? colors.blue : 'transparent',
          },
        ]}
      />
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { color: colors.label }]} numberOfLines={1}>
          {contactName(contact)}
        </Text>
        <Text style={[type.caption, { color: colors.label2 }]} numberOfLines={1}>
          {contact.phone ? prettyPhone(contact.phone) : contact.email}
        </Text>
      </View>
      {contact.flagged ? (
        <View style={{ marginLeft: space.sm }}>
          <Badge label="Flagged" tone="warn" />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  option: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 2 },
  bulkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  box: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.6 },
});
