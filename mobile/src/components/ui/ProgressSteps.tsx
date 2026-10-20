import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, space, themed } from '../../theme';
import { Icon } from './Icon';
import { T } from './Text';

/**
 * Order / booking progress: a rail of steps with ticks for completed ones,
 * a ring on the current one, and the step name under each — so progress is
 * readable without relying on colour. Cancelled shows the rail greyed with a
 * note instead of pretending a step was reached.
 */
export function ProgressSteps({
  steps,
  current,
  cancelled,
}: {
  steps: { key: string; label: string }[];
  current: string;
  cancelled?: boolean;
}) {
  const idx = steps.findIndex((s) => s.key === current);
  const summary = cancelled
    ? 'Cancelled'
    : idx >= 0
    ? `Step ${idx + 1} of ${steps.length}: ${steps[idx].label}`
    : steps.map((s) => s.label).join(', ');
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={summary}>
      <View style={styles.rail}>
        {steps.map((s, i) => {
          const done = !cancelled && i < idx;
          const now = !cancelled && i === idx;
          return (
            <React.Fragment key={s.key}>
              {i > 0 ? (
                <View
                  style={[
                    styles.line,
                    { backgroundColor: !cancelled && i <= idx ? colors.gold : colors.border },
                  ]}
                />
              ) : null}
              <View
                style={[
                  styles.node,
                  done && { backgroundColor: colors.gold, borderColor: colors.gold },
                  now && { borderColor: colors.gold, borderWidth: 2, backgroundColor: colors.accentBg },
                ]}
              >
                {done ? <Icon name="Check" size={12} color={colors.onGold} strokeWidth={3} /> : null}
                {now ? <View style={styles.dot} /> : null}
              </View>
            </React.Fragment>
          );
        })}
      </View>
      <View style={styles.labels}>
        {steps.map((s, i) => (
          <T
            key={s.key}
            variant="small"
            numberOfLines={2}
            align={i === 0 ? 'left' : i === steps.length - 1 ? 'right' : 'center'}
            style={[styles.label, i === idx && !cancelled && { color: colors.text, fontWeight: '600' }]}
          >
            {s.label}
          </T>
        ))}
      </View>
      {cancelled ? (
        <T variant="small" color={colors.danger} style={{ marginTop: space.xs }}>
          Cancelled — no further steps
        </T>
      ) : null}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    rail: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 },
    line: { flex: 1, height: 2, marginHorizontal: 2, borderRadius: 1 },
    node: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold },
    labels: { flexDirection: 'row', marginTop: space.xs },
    label: { flex: 1, fontSize: 11, lineHeight: 14 },
  })
);
