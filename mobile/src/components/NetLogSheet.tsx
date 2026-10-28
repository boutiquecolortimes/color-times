import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { netlog, type NetEntry } from '../lib/netlog';
import { colors, radius, space } from '../theme';
import { Button, Pill, Sheet, T, Tap } from './ui';

const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });

function pretty(value: unknown): string {
  if (value === undefined) return '—';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function Block({ label, value }: { label: string; value: unknown }) {
  const text = pretty(value);
  return (
    <View style={{ marginTop: space.sm }}>
      <T variant="caption">{label}</T>
      <View
        style={{
          marginTop: space.xs,
          padding: space.sm,
          borderRadius: radius.sm,
          backgroundColor: colors.surfaceHigh,
        }}
      >
        <T selectable style={{ fontFamily: mono, fontSize: 11, lineHeight: 15, color: colors.text }}>
          {text.length > 6000 ? `${text.slice(0, 6000)}\n… (truncated)` : text}
        </T>
      </View>
    </View>
  );
}

function Row({ e }: { e: NetEntry }) {
  const [open, setOpen] = useState(false);
  const tone = e.error ? 'danger' : e.status === undefined ? 'muted' : e.status >= 400 ? 'danger' : 'success';
  return (
    <View
      style={{
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingVertical: space.sm,
      }}
    >
      <Tap
        onPress={() => setOpen((o) => !o)}
        hapticOnPress={false}
        accessibilityLabel={`${e.method} ${e.path}, ${e.status ?? (e.error ? 'failed' : 'pending')}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
      >
        <Pill small tone={tone} label={e.error ? 'ERR' : e.status ? String(e.status) : '…'} />
        <T variant="smallStrong" style={{ width: 52 }}>
          {e.method}
        </T>
        <T
          variant="small"
          numberOfLines={open ? undefined : 1}
          style={{ flex: 1, fontFamily: mono, fontSize: 12 }}
        >
          {e.path}
        </T>
        <T variant="small" color={colors.textFaint}>
          {e.ms !== undefined ? `${e.ms} ms` : ''}
        </T>
      </Tap>
      {open ? (
        <View style={{ paddingLeft: space.xs }}>
          <T variant="small" color={colors.textFaint} style={{ marginTop: space.xs }}>
            {new Date(e.at).toLocaleTimeString()}
          </T>
          {e.query ? <Block label="Query parameters" value={e.query} /> : null}
          {e.body !== undefined ? <Block label="Request body" value={e.body} /> : null}
          {e.error ? <Block label="Error" value={e.error} /> : <Block label="Response" value={e.response} />}
        </View>
      ) : null}
    </View>
  );
}

/** Development builds only: every API call with its parameters and response. */
export function NetLogSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  // The log is a mutable buffer; re-render on every change while the sheet is open.
  const [, bump] = useState(0);
  useEffect(() => (visible ? netlog.subscribe(() => bump((n) => n + 1)) : undefined), [visible]);
  const list = netlog.entries();

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="API log"
      subtitle="Newest first · tap a call for its parameters and response · secrets are masked"
      maxHeight={0.92}
      footer={<Button title="Clear" variant="outline" icon="Trash" onPress={() => netlog.clear()} />}
    >
      {list.length === 0 ? (
        <T variant="small" style={{ paddingVertical: space.lg }}>
          No API calls yet.
        </T>
      ) : (
        list.map((e) => <Row key={e.id} e={e} />)
      )}
    </Sheet>
  );
}
