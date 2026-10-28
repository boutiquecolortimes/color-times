import React from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from '../ui';
import { colors, radius, space, themed } from '../../theme';
import { inr } from '../../lib/format';

const LABELS: Record<string, string> = {
  totalAmount: 'Total',
  securityDeposit: 'Security',
  advancePaid: 'Collected',
  advancePayment: 'Collected',
  dueAmount: 'Due',
};

/** Money totals across the whole filtered list (not just the loaded page). */
export function SummaryStrip({ summary }: { summary?: Record<string, unknown> | null }) {
  if (!summary) return null;
  const entries = Object.entries(summary).filter(([k, v]) => typeof v === 'number' && LABELS[k]) as [
    string,
    number
  ][];
  if (!entries.length) return null;
  return (
    <View style={styles.row}>
      {entries.map(([key, value]) => (
        <View key={key} style={styles.cell}>
          <T variant="caption" numberOfLines={1}>
            {LABELS[key]}
          </T>
          <T
            variant="bodyStrong"
            numberOfLines={1}
            adjustsFontSizeToFit
            color={key === 'dueAmount' && value > 0 ? colors.warning : colors.text}
          >
            {inr(value)}
          </T>
        </View>
      ))}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
    cell: {
      flex: 1,
      paddingVertical: space.sm,
      paddingHorizontal: space.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
  })
);
