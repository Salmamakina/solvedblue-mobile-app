import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiErrorMessage } from '../../src/api/client';
import {
  CONTACTS_QUERY_KEY,
  contactsApi,
  MAX_IMPORT_ROWS,
  type ContactInput,
  type ImportResult,
  type SheetTable,
} from '../../src/api/contacts';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Field } from '../../src/components/Field';
import { Screen } from '../../src/components/Screen';
import { useTheme } from '../../src/theme/useTheme';
import { mapSheetRows, describeMapping } from '../../src/utils/importMapping';

/**
 * Imports contacts from a Google Sheet shared by link, mirroring the web's
 * ImportDialog in the part that works without a file picker.
 *
 * The web also accepts a dropped CSV or XLSX, which it parses in the browser.
 * There is no equivalent here yet: that needs a document picker and a
 * spreadsheet parser, so a link is the one path for now and the screen says so.
 *
 * Columns are matched by their header name rather than asking the user to map
 * each one, which keeps this to a single screen. The match is shown before
 * anything is sent, so a wrong guess is visible first.
 */
export default function ImportContactsScreen() {
  const { colors, type, space } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [url, setUrl] = useState('');
  const [table, setTable] = useState<SheetTable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const load = useMutation({
    mutationFn: () => contactsApi.googleSheet(url.trim()),
    onSuccess: (sheet) => {
      setTable(sheet);
      setError(null);
    },
    onError: (err) => {
      setTable(null);
      setError(apiErrorMessage(err, 'Could not read that sheet'));
    },
  });

  // What the headers map to, worked out once per sheet.
  const mapped = useMemo(() => (table ? mapSheetRows(table) : null), [table]);

  const send = useMutation({
    mutationFn: (rows: ContactInput[]) => contactsApi.import('google_sheet', rows),
    onSuccess: (counts) => {
      setResult(counts);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: [CONTACTS_QUERY_KEY] });
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not import those contacts')),
  });

  const tooMany = (mapped?.rows.length ?? 0) > MAX_IMPORT_ROWS;

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
          {result ? (
            <Card title="Import finished">
              <View style={{ gap: space.sm }}>
                <Row label="Added" value={result.added} />
                <Row label="Updated" value={result.updated} />
                {result.invalid > 0 ? (
                  <Row label="Skipped, no phone or email" value={result.invalid} />
                ) : null}
                {result.opted_out > 0 ? (
                  <Row label="Skipped, opted out" value={result.opted_out} />
                ) : null}
              </View>
            </Card>
          ) : (
            <>
              <Card title="From a Google Sheet">
                <View style={{ gap: space.md }}>
                  <Text style={[type.footnote, { color: colors.label2 }]}>
                    Share the sheet as &quot;anyone with the link can view&quot;, then paste its
                    link here. The first row should be the column names.
                  </Text>
                  <Field
                    label="Sheet link"
                    value={url}
                    onChangeText={(text) => {
                      setUrl(text);
                      setTable(null);
                      setError(null);
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    placeholder="https://docs.google.com/spreadsheets/..."
                  />
                  <Button
                    label="Read sheet"
                    variant="secondary"
                    onPress={() => load.mutate()}
                    disabled={url.trim().length === 0}
                    loading={load.isPending}
                  />
                </View>
              </Card>

              {mapped ? (
                <Card title="What we found">
                  <View style={{ gap: space.sm }}>
                    <Text style={[type.body, { color: colors.label }]}>
                      {mapped.rows.length} {mapped.rows.length === 1 ? 'contact' : 'contacts'}
                    </Text>
                    <Text style={[type.caption, { color: colors.label2 }]}>
                      {describeMapping(mapped.matched)}
                    </Text>
                    {mapped.rows.length === 0 ? (
                      <Text style={[type.footnote, { color: colors.orange }]}>
                        No row had a phone number or an email, so there is nothing to import.
                        Check the column names.
                      </Text>
                    ) : null}
                    {tooMany ? (
                      <Text style={[type.footnote, { color: colors.orange }]}>
                        That is more than {MAX_IMPORT_ROWS.toLocaleString()} rows. Split the sheet
                        and import it in parts.
                      </Text>
                    ) : null}
                  </View>
                </Card>
              ) : null}
            </>
          )}

          {error ? (
            <Text accessibilityRole="alert" style={[type.footnote, { color: colors.red }]}>
              {error}
            </Text>
          ) : null}

          {result ? (
            <Button label="Done" onPress={() => router.back()} />
          ) : mapped && mapped.rows.length > 0 ? (
            <Button
              label={`Import ${mapped.rows.length} ${
                mapped.rows.length === 1 ? 'contact' : 'contacts'
              }`}
              onPress={() => send.mutate(mapped.rows)}
              disabled={tooMany}
              loading={send.isPending}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  const { colors, type } = useTheme();
  return (
    <View style={styles.between}>
      <Text style={[type.footnote, { color: colors.label2 }]}>{label}</Text>
      <Text style={[type.headline, { color: colors.label }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
