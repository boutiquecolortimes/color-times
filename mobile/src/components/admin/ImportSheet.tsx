import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { api, errorMessage } from '../../api/client';
import { useInvalidate } from '../../api/hooks';
import { Button, Card, Pill, Row, Sheet, T, toast } from '../ui';
import { colors, space } from '../../theme';
import { exportTable, pickSpreadsheet } from '../../lib/files';

interface ImportResult {
  row: number;
  name: string;
  status: 'created' | 'skipped';
  reason?: string;
}

/**
 * Bulk import from a CSV / Excel file — same column names and endpoint
 * (`{ rows }`, max 500 per request) as the web admin's import dialog.
 */
export function ImportSheet({
  visible,
  onClose,
  title,
  endpoint,
  columns,
  invalidatePath,
  sample,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  endpoint: string;
  columns: string[];
  invalidatePath: string;
  /** Example row for the downloadable template (same as the web's "Download Template"). */
  sample?: string[];
}) {
  const invalidate = useInvalidate();
  const [file, setFile] = useState<{ name: string; rows: Record<string, string>[] } | null>(null);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [busy, setBusy] = useState(false);

  const choose = async () => {
    try {
      const picked = await pickSpreadsheet();
      if (picked) {
        setFile(picked);
        setResults(null);
      }
    } catch (e) {
      toast.error('Could not read file', errorMessage(e));
    }
  };

  const run = async () => {
    if (!file?.rows.length) return;
    setBusy(true);
    const all: ImportResult[] = [];
    try {
      for (let i = 0; i < file.rows.length; i += 500) {
        const r = await api.post<{ results: ImportResult[] }>(endpoint, {
          rows: file.rows.slice(i, i + 500),
        });
        all.push(...r.results.map((x) => ({ ...x, row: x.row + i })));
      }
      setResults(all);
      invalidate(invalidatePath);
      toast.success(`Imported ${all.filter((r) => r.status === 'created').length} of ${all.length}`);
    } catch (e) {
      toast.error('Import failed', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setFile(null);
    setResults(null);
    onClose();
  };

  const created = results?.filter((r) => r.status === 'created').length ?? 0;

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={title}
      subtitle="CSV or Excel, first row = column names"
      footer={
        results ? (
          <Button title="Done" onPress={close} />
        ) : file ? (
          <View style={{ gap: space.sm }}>
            <Button title={`Import ${file.rows.length} rows`} onPress={run} loading={busy} />
            <Button title="Choose another file" variant="ghost" onPress={choose} />
          </View>
        ) : (
          <Button title="Choose file" icon="FileText" onPress={choose} />
        )
      }
    >
      <Card>
        <T variant="caption">Columns</T>
        <T variant="small" style={{ marginTop: 4 }}>
          {columns.join(', ')}
        </T>
        <Button
          title="Download template"
          icon="Download"
          variant="ghost"
          size="sm"
          style={{ alignSelf: 'flex-start', marginTop: space.sm, marginLeft: -space.sm }}
          onPress={() =>
            exportTable({
              format: 'csv',
              filename: `${title.toLowerCase().replace(/^import /, '')}-import-template`,
              title,
              headers: columns,
              rows: sample ? [sample] : [],
            }).catch((e) => toast.error(errorMessage(e)))
          }
        />
      </Card>
      {file && !results ? (
        <Card style={{ marginTop: space.md }}>
          <T variant="bodyStrong">{file.name}</T>
          <T variant="small">{file.rows.length} rows found</T>
          {file.rows.slice(0, 5).map((r, i) => (
            <T key={i} variant="small" numberOfLines={1} style={{ marginTop: 4 }}>
              {i + 1}. {r.name ?? Object.values(r)[0]}
            </T>
          ))}
        </Card>
      ) : null}
      {results ? (
        <>
          <Row style={{ marginTop: space.md }}>
            <Pill label={`${created} created`} tone="success" />
            <Pill
              label={`${results.length - created} skipped`}
              tone={results.length - created ? 'warning' : 'muted'}
            />
          </Row>
          <ScrollView style={{ maxHeight: 300, marginTop: space.md }}>
            {results
              .filter((r) => r.status === 'skipped')
              .map((r) => (
                <T key={r.row} variant="small" color={colors.warning} style={{ marginBottom: 4 }}>
                  Row {r.row} · {r.name || '—'}: {r.reason}
                </T>
              ))}
          </ScrollView>
        </>
      ) : null}
    </Sheet>
  );
}
