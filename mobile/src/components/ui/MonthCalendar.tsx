import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius, space, themed } from '../../theme';
import { T } from './Text';
import { Tap } from './Pressable';
import { IconButton } from './Button';
import { isoDay } from '../../lib/format';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export interface DayMark {
  /** Up to 3 coloured dots under the date. */
  dots?: string[];
  /** Fill the whole cell (e.g. booked range). */
  fill?: string;
  count?: number;
}

/** Month grid with marks — used for the booking calendar and dress availability. */
export function MonthCalendar({
  month,
  onMonthChange,
  marks,
  selected,
  onSelect,
}: {
  month: Date;
  onMonthChange: (d: Date) => void;
  marks: Record<string, DayMark>;
  selected?: string | null;
  onSelect?: (iso: string) => void;
}) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];
  while (cells.length % 7) cells.push(null);
  const today = isoDay();

  return (
    <View>
      <View style={styles.head}>
        <IconButton
          icon="ChevronLeft"
          size={34}
          onPress={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          accessibilityLabel="Previous month"
        />
        <T variant="h3">
          {MONTHS[month.getMonth()]} {month.getFullYear()}
        </T>
        <IconButton
          icon="ChevronRight"
          size={34}
          onPress={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          accessibilityLabel="Next month"
        />
      </View>
      <View style={styles.row}>
        {DOW.map((d, i) => (
          <T key={i} variant="caption" align="center" style={styles.cellW}>
            {d}
          </T>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((date, i) => {
          if (!date) return <View key={i} style={[styles.cellW, styles.cell]} />;
          const iso = isoDay(date);
          const mark = marks[iso];
          const isSel = selected === iso;
          return (
            <Tap
              key={i}
              onPress={onSelect ? () => onSelect(iso) : undefined}
              disabled={!onSelect}
              hapticOnPress={false}
              scaleTo={0.92}
              style={[styles.cellW]}
            >
              <View
                style={[
                  styles.cell,
                  mark?.fill ? { backgroundColor: mark.fill } : null,
                  iso === today && styles.today,
                  isSel && styles.selected,
                ]}
              >
                <T variant="smallStrong" color={isSel ? colors.onPrimary : colors.text}>
                  {date.getDate()}
                </T>
                <View style={styles.dots}>
                  {(mark?.dots ?? []).slice(0, 3).map((c, j) => (
                    <View key={j} style={[styles.dot, { backgroundColor: isSel ? colors.onPrimary : c }]} />
                  ))}
                </View>
              </View>
            </Tap>
          );
        })}
      </View>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: space.md,
    },
    row: { flexDirection: 'row', marginBottom: space.xs },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cellW: { width: `${100 / 7}%` },
    cell: { height: 46, margin: 2, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
    today: { borderWidth: 1, borderColor: colors.goldDeep },
    selected: { backgroundColor: colors.primary },
    dots: { flexDirection: 'row', gap: 2, height: 5, marginTop: 2 },
    dot: { width: 5, height: 5, borderRadius: 2.5 },
  })
);
