import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiErrorMessage } from '../../src/api/client';
import {
  CONTACTS_QUERY_KEY,
  contactsApi,
  isOptedOutError,
  OPTED_OUT_MESSAGE,
  type ContactInput,
} from '../../src/api/contacts';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Field } from '../../src/components/Field';
import { Screen } from '../../src/components/Screen';
import { useTheme } from '../../src/theme/useTheme';

/**
 * Adds one contact by hand, mirroring the web's AddContactDialog.
 *
 * The server requires a phone number or an email, so the button stays disabled
 * until there is one. Everything else is optional.
 */
export default function NewContactScreen() {
  const { colors, type, space } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [tags, setTags] = useState('');
  const [error, setError] = useState<string | null>(null);

  const hasAddress = phone.trim().length > 0 || email.trim().length > 0;

  const create = useMutation({
    mutationFn: () => {
      // Only send what was filled in: an empty string would be stored as one.
      const input: ContactInput = {};
      if (phone.trim()) input.phone = phone.trim();
      if (email.trim()) input.email = email.trim();
      if (firstName.trim()) input.first_name = firstName.trim();
      if (lastName.trim()) input.last_name = lastName.trim();
      const list = tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
      if (list.length > 0) input.tags = list;
      return contactsApi.create(input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [CONTACTS_QUERY_KEY] });
      router.back();
    },
    onError: (err) =>
      setError(
        isOptedOutError(err) ? OPTED_OUT_MESSAGE : apiErrorMessage(err, 'Could not add the contact')
      ),
  });

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
            <View style={{ gap: space.md }}>
              <Field
                label="First name"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                placeholder="Jordan"
              />
              <Field
                label="Last name"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                placeholder="Diaz"
              />
              <Field
                label="Phone"
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  setError(null);
                }}
                keyboardType="phone-pad"
                autoCapitalize="none"
                placeholder="+1 805 215 2331"
                hint="A phone number or an email is required."
              />
              <Field
                label="Email"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setError(null);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="jordan@example.com"
              />
              <Field
                label="Tags"
                value={tags}
                onChangeText={setTags}
                autoCapitalize="none"
                placeholder="buyer, hollister"
                hint="Separate tags with commas."
              />
            </View>
          </Card>

          {error ? (
            <Text accessibilityRole="alert" style={[type.footnote, { color: colors.red }]}>
              {error}
            </Text>
          ) : null}

          <Button
            label="Add contact"
            onPress={() => create.mutate()}
            disabled={!hasAddress}
            loading={create.isPending}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
