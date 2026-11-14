import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
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
  type ImportSource,
  type SheetTable,
} from '../../src/api/contacts';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Field } from '../../src/components/Field';
import { Screen } from '../../src/components/Screen';
import { useTheme } from '../../src/theme/useTheme';
import { describeMapping, mapSheetRows } from '../../src/utils/importMapping';
import {
  FILE_LIMIT_MESSAGE,
  parseSheetFile,
  SHEET_MIME_TYPES,
  SheetFileError,
} from '../../src/utils/parseSheetFile';

/**
 * Imports contacts from a CSV, an Excel file or a Google Sheet, mirroring the
 * web's ImportDialog.
 *
 * Both sources end as the same `{ headers, rows }` table, so there is one
 * mapping path and one confirmation step however the rows arrived: a file is
 * parsed on the phone by the same SheetJS version the web pins, and a link is
 * read by the server.
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
  // Which source the rows came from. The server records it, and picking one
  // clears the other so there is never a file and a link both loaded.
  const [source, setSource] = useState<ImportSource | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const load = useMutation({
    mutationFn: () => contactsApi.googleSheet(url.trim()),
    onSuccess: (sheet) => {
      setTable(sheet);
      setSource('google_sheet');
      setFileName(null);
      setError(null);
    },
    onError: (err) => {
      setTable(null);
      setSource(null);
      setError(apiErrorMessage(err, 'Could not read that sheet'));
    },
  });

  /** Picks a spreadsheet and parses it here, with no round trip. */
  async function pickFile() {
    const picked = await DocumentPicker.getDocumentAsync({
      type: SHEET_MIME_TYPES,
      // The picker's own URI can be a content:// handle that is not readable
      // after the picker closes; a cache copy is.
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled) return;

    const asset = picked.assets[0];
    if (!asset) return;

    setReading(true);
    try {
      const parsed = await parseSheetFile({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
        size: asset.size,
      });
      setTable(parsed);
      setSource('file');
      setFileName(asset.name);
      setUrl('');
      setError(null);
    } catch (err) {
      setTable(null);
      setSource(null);
      setFileName(null);
      // SheetFileError already says what is wrong with that specific file.
      setError(err instanceof SheetFileError ? err.message : "Couldn't read that file.");
    } finally {
      setReading(false);
    }
  }

  // What the headers map to, worked out once per sheet.
  const mapped = useMemo(() => (table ? mapSheetRows(table) : null), [table]);

  const send = useMutation({
    mutationFn: (rows: ContactInput[]) => contactsApi.import(source ?? 'google_sheet', rows),
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
              <Card title="From a file">
                <View style={{ gap: space.md }}>
                  <Text style={[type.footnote, { color: colors.label2 }]}>
                    A CSV, XLSX or XLS file. The first row should be the column names.{' '}
                    {FILE_LIMIT_MESSAGE}.
                  </Text>
                  {fileName ? (
                    <Text style={[type.footnote, { color: colors.label, fontWeight: '600' }]}>
                      {fileName}
                    </Text>
                  ) : null}
                  <Button
                    label={fileName ? 'Choose a different file' : 'Choose a file'}
                    variant="secondary"
                    onPress={() => void pickFile()}
                    loading={reading}
                  />
                </View>
              </Card>

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
                      setSource(null);
                      setFileName(null);
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
                        That is more than {MAX_IMPORT_ROWS.toLocaleString()} rows. Split it and
                        import it in parts.
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
