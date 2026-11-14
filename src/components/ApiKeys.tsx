import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { accountApi } from '../api/account';
import { apiErrorMessage } from '../api/client';
import { useTheme } from '../theme/useTheme';
import { relativeTime } from '../utils/format';
import { Button } from './Button';
import { Card } from './Card';
import { Field } from './Field';
/**
 * The organization's API keys. Creating and revoking are admin-only on the
 * server, so a member sees the list without the controls rather than buttons
 * that would 403.
 */
export function ApiKeys({ canManage, hasAccess }: { canManage: boolean; hasAccess: boolean }) {
  const { colors, type, space } = useTheme();
  const queryClient = useQueryClient();
  // Naming happens inline rather than in Alert.prompt, which is iOS only.
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const keys = useQuery({
    queryKey: ['api-keys'],
    queryFn: accountApi.listKeys,
    enabled: hasAccess,
  });

  const create = useMutation({
    mutationFn: (keyName: string) => accountApi.createKey(keyName),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setNaming(false);
      setName('');
      // The secret exists in this response and nowhere else, so it is put on
      // the clipboard straight away rather than shown in a dialog that could
      // be dismissed before it is copied.
      void Clipboard.setStringAsync(created.key);
      Alert.alert(
        'Key created and copied',
        'The full key is on your clipboard. Save it somewhere safe: it cannot be shown again.'
      );
    },
    onError: (err) => Alert.alert('API keys', apiErrorMessage(err, 'Could not create the key')),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => accountApi.revokeKey(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
    onError: (err) => Alert.alert('API keys', apiErrorMessage(err, 'Could not revoke the key')),
  });

  if (!hasAccess) {
    return (
      <Card title="API keys">
        <Text style={[type.footnote, { color: colors.label2 }]}>
          Your plan does not include API access.
        </Text>
      </Card>
    );
  }

  return (
    <Card title="API keys">
      <View style={{ gap: space.md }}>
        {keys.isLoading ? (
          <Text style={[type.footnote, { color: colors.label2 }]}>Loading…</Text>
        ) : (keys.data?.length ?? 0) === 0 ? (
          <Text style={[type.footnote, { color: colors.label2 }]}>
            No keys yet. A key lets an assistant or a script use your workspace.
          </Text>
        ) : (
          keys.data?.map((key) => (
            <View key={key.id} style={styles.between}>
              <View style={{ flex: 1 }}>
                <Text style={[type.body, { color: colors.label }]} numberOfLines={1}>
                  {key.name}
                </Text>
                <Text style={[type.caption, { color: colors.label2 }]}>
                  {key.prefix}… ·{' '}
                  {key.last_used_at ? `used ${relativeTime(key.last_used_at)}` : 'never used'}
                </Text>
              </View>
              {canManage ? (
                <Pressable
                  onPress={() =>
                    Alert.alert(
                      'Revoke this key?',
                      `Anything using "${key.name}" will stop working. This cannot be undone.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Revoke',
                          style: 'destructive',
                          onPress: () => revoke.mutate(key.id),
                        },
                      ]
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Revoke ${key.name}`}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginLeft: space.sm })}
                >
                  <Text style={[type.footnote, { color: colors.red, fontWeight: '600' }]}>
                    Revoke
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))
        )}

        {canManage ? (
          naming ? (
            <View style={{ gap: space.sm }}>
              <Field
                label="Key name"
                value={name}
                onChangeText={setName}
                placeholder="My assistant"
                hint="So you can tell it apart later."
                autoFocus
              />
              <View style={styles.pair}>
                <Button
                  label="Create"
                  onPress={() => create.mutate(name.trim())}
                  disabled={name.trim().length === 0}
                  loading={create.isPending}
                  style={styles.half}
                />
                <Button
                  label="Cancel"
                  variant="secondary"
                  onPress={() => {
                    setNaming(false);
                    setName('');
                  }}
                  style={styles.half}
                />
              </View>
            </View>
          ) : (
            <Button label="Create key" variant="secondary" onPress={() => setNaming(true)} />
          )
        ) : (
          <Text style={[type.caption, { color: colors.label2 }]}>
            Only an admin can create or revoke keys.
          </Text>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pair: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
});