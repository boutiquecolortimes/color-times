import React, { useState } from 'react';
import { View } from 'react-native';
import { useApi } from '../../api/hooks';
import { Card, Section, T, Tap } from '../ui';
import { colors, space } from '../../theme';
import { fmtDateTime, titleCase } from '../../lib/format';

interface Entry {
  _id: string;
  action: string;
  actorName: string;
  changes: { field: string; from: unknown; to: unknown }[];
  metadata?: Record<string, unknown>;
  createdAt: string;
}

function show(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return fmtDateTime(value);
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 80);
  return String(value);
}

/** "Change history" — who changed what and when (same audit log the web admin shows). */
export function AuditHistory({ entityType, entityId }: { entityType: string; entityId: string }) {
  const [open, setOpen] = useState(false);
  const q = useApi<{ entries: Entry[] }>(open ? '/api/admin/audit-log' : null, { entityType, entityId });
  return (
    <Section title="Change history" action={open ? 'Hide' : 'Show'} onAction={() => setOpen(!open)}>
      {open ? (
        <Card>
          {q.isLoading ? <T variant="small">Loading…</T> : null}
          {q.data?.entries.length === 0 ? <T variant="small">No changes recorded.</T> : null}
          {q.data?.entries.map((e, i) => (
            <View
              key={e._id}
              style={{
                paddingVertical: space.sm,
                borderTopWidth: i ? 0.5 : 0,
                borderTopColor: colors.border,
              }}
            >
              <T variant="smallStrong">
                {titleCase(e.action)} · {e.actorName}
              </T>
              <T variant="small" color={colors.textFaint}>
                {fmtDateTime(e.createdAt)}
              </T>
              {e.changes.slice(0, 8).map((c) => (
                <T key={c.field} variant="small" style={{ marginTop: 2 }}>
                  {titleCase(c.field.replace(/([A-Z])/g, ' $1'))}: {show(c.from)} →{' '}
                  <T variant="small" gold>
                    {show(c.to)}
                  </T>
                </T>
              ))}
            </View>
          ))}
        </Card>
      ) : (
        <Tap onPress={() => setOpen(true)} hapticOnPress={false}>
          <T variant="small">Tap “Show” to see every change made to this record.</T>
        </Tap>
      )}
    </Section>
  );
}
