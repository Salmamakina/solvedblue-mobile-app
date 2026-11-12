import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { apiErrorMessage } from '../../src/api/client';
import { WORKFLOWS_QUERY_KEY, workflowsApi } from '../../src/api/workflows';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Field } from '../../src/components/Field';
import { Screen } from '../../src/components/Screen';
import { useTheme } from '../../src/theme/useTheme';
import {
  definitionOf,
  DELAY_UNITS,
  singular,
  validateSteps,
  type DelayUnit,
  type WorkflowStep,
} from '../../src/utils/workflowSteps';

/**
 * Builds a workflow as a list of steps: messages, with optional waits between
 * them. See src/utils/workflowSteps.ts for why this is a list rather than the
 * web's canvas, and for the graph it produces.
 *
 * Saved published, because a campaign can only use a published workflow and
 * there is no reason to make that a second trip on a phone.
 */
export default function NewWorkflowScreen() {
  const { colors, type, space } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [steps, setSteps] = useState<WorkflowStep[]>([{ kind: 'message', text: '' }]);
  const [error, setError] = useState<string | null>(null);

  const problem = validateSteps(steps);
  const canSave = name.trim().length > 0 && problem === null;

  const save = useMutation({
    mutationFn: async () => {
      const workflow = await workflowsApi.create(name.trim(), definitionOf(steps));
      // A campaign can only pick a published workflow, so publish it now.
      return workflowsApi.update(workflow.id, { status: 'published' });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [WORKFLOWS_QUERY_KEY] });
      router.back();
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not save the workflow')),
  });

  function update(index: number, step: WorkflowStep) {
    setSteps((current) => current.map((item, i) => (i === index ? step : item)));
  }

  function remove(index: number) {
    setSteps((current) => current.filter((_, i) => i !== index));
  }

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
              label="Workflow name"
              value={name}
              onChangeText={setName}
              placeholder="Hollister Ave follow-up"
              hint="Campaigns pick a workflow by this name."
            />
          </Card>

          {steps.map((step, index) =>
            step.kind === 'message' ? (
              <Card key={index} title={`Message ${messageNumber(steps, index)}`}>
                <View style={{ gap: space.sm }}>
                  <Field
                    label="Text"
                    value={step.text}
                    onChangeText={(text) => update(index, { kind: 'message', text })}
                    placeholder="Hi, saw you were looking at places nearby. Still searching?"
                    multiline
                    style={styles.multiline}
                  />
                  {steps.length > 1 ? (
                    <Pressable
                      onPress={() => remove(index)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove message ${messageNumber(steps, index)}`}
                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                    >
                      <Text style={[type.footnote, { color: colors.red }]}>Remove</Text>
                    </Pressable>
                  ) : null}
                </View>
              </Card>
            ) : (
              <Card key={index} title="Wait">
                <View style={{ gap: space.md }}>
                  <View style={styles.waitRow}>
                    <View style={styles.waitValue}>
                      <Field
                        label="How long"
                        value={String(step.value)}
                        onChangeText={(text) => {
                          const value = parseInt(text.replace(/\D/g, ''), 10);
                          update(index, {
                            ...step,
                            value: Number.isFinite(value) && value > 0 ? value : 1,
                          });
                        }}
                        keyboardType="number-pad"
                      />
                    </View>
                    <View style={{ flex: 1, gap: space.xs }}>
                      <Text style={[type.footnote, { color: colors.label2, fontWeight: '600' }]}>
                        Unit
                      </Text>
                      <View style={styles.units}>
                        {DELAY_UNITS.map(({ key, label }) => {
                          const active = key === step.unit;
                          return (
                            <Pressable
                              key={key}
                              onPress={() => update(index, { ...step, unit: key })}
                              accessibilityRole="radio"
                              accessibilityState={{ selected: active }}
                              accessibilityLabel={label}
                              style={({ pressed }) => [
                                styles.unit,
                                {
                                  backgroundColor: active ? colors.blue : colors.fill,
                                  opacity: pressed && !active ? 0.6 : 1,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  type.caption,
                                  {
                                    color: active ? '#FFFFFF' : colors.label2,
                                    fontWeight: '600',
                                  },
                                ]}
                              >
                                {label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  </View>
                  <Text style={[type.caption, { color: colors.label2 }]}>
                    Everything after this waits {step.value} {singular(step.value, step.unit)}.
                  </Text>
                  <Pressable
                    onPress={() => remove(index)}
                    accessibilityRole="button"
                    accessibilityLabel="Remove wait"
                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  >
                    <Text style={[type.footnote, { color: colors.red }]}>Remove</Text>
                  </Pressable>
                </View>
              </Card>
            )
          )}

          <View style={styles.addRow}>
            <Button
              label="Add message"
              variant="secondary"
              onPress={() => setSteps((c) => [...c, { kind: 'message', text: '' }])}
              style={styles.flex}
            />
            <Button
              label="Add wait"
              variant="secondary"
              onPress={() =>
                setSteps((c) => [...c, { kind: 'wait', value: 1, unit: 'days' as DelayUnit }])
              }
              style={styles.flex}
            />
          </View>

          {problem && steps.length > 0 ? (
            <Text style={[type.footnote, { color: colors.label2 }]}>{problem}</Text>
          ) : null}
          {error ? (
            <Text accessibilityRole="alert" style={[type.footnote, { color: colors.red }]}>
              {error}
            </Text>
          ) : null}

          <Button
            label="Save workflow"
            onPress={() => save.mutate()}
            disabled={!canSave}
            loading={save.isPending}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** Messages are numbered among themselves, so a wait does not take a number. */
function messageNumber(steps: WorkflowStep[], index: number): number {
  return steps.slice(0, index + 1).filter((step) => step.kind === 'message').length;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  addRow: { flexDirection: 'row', gap: 8 },
  waitRow: { flexDirection: 'row', gap: 12 },
  waitValue: { width: 96 },
  units: { flexDirection: 'row', gap: 6 },
  unit: {
    borderRadius: 999,
    paddingHorizontal: 10,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
