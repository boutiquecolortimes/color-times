import React from 'react';
import { View } from 'react-native';
import type { Booking } from '../../../api/types';
import { Img, ListScreen, Meta, Pill, Row, T, Tap, Card } from '../../../components/ui';
import { colors, space } from '../../../theme';
import { useNav, useParams } from '../../../navigation/nav';
import { fmtDate, fmtRange, inr } from '../../../lib/format';
import {
  DEPOSIT_STATE,
  bookingDepositState,
  bookingRemainingDue,
  bookingRent,
} from '../../../lib/bookingMoney';
import { SummaryStrip } from '../../../components/admin/SummaryStrip';
import { BOOKING_STATUS } from '../../../lib/labels';
import { BULK, EXPORTS, SORTS, TRASH } from '../listConfig';
import { useRole } from '../../../auth/AuthContext';
import { canSettings } from '../../../lib/roles';

const CHIPS = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_use', label: 'Picked up' },
  { value: 'returned', label: 'Returned' },
  { value: 'cancelled', label: 'Cancelled' },
];

function depositBadge(b: Parameters<typeof bookingDepositState>[0]) {
  const state = bookingDepositState(b);
  if (state === 'refunded' && b.depositRefundedAt) return `Refunded ${fmtDate(b.depositRefundedAt)}`;
  return state === 'none' ? '' : DEPOSIT_STATE[state].label;
}

export function BookingCard({ booking, onPress }: { booking: Booking; onPress: () => void }) {
  const status = BOOKING_STATUS[booking.status];
  const rent = bookingRent(booking);
  const due = bookingRemainingDue(booking);
  const deposit = bookingDepositState(booking);
  const first = booking.items[0]?.product;
  return (
    <Tap onPress={onPress} scaleTo={0.985} style={{ marginBottom: space.sm }}>
      <Card padded={false} style={{ padding: space.md }}>
        <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
          <Img src={first?.images?.[0]} style={{ width: 58, height: 74 }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T variant="caption">#{booking.billNumber || booking.bookingNumber}</T>
              <Pill label={status?.label ?? booking.status} tone={status?.tone} small />
            </Row>
            <T variant="bodyStrong" numberOfLines={1} style={{ marginTop: 2 }}>
              {booking.customer?.name ?? 'Customer'}
            </T>
            <T variant="small" numberOfLines={1}>
              {booking.items
                .map((i) => i.product?.name)
                .filter(Boolean)
                .join(', ') || '—'}
            </T>
            <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
              <T variant="small" color={colors.textMuted}>
                {fmtRange(booking.rentalStartDate, booking.rentalEndDate)}
              </T>
              <T
                variant="smallStrong"
                color={due > 0 && booking.status !== 'cancelled' ? colors.warning : colors.text}
              >
                {due > 0 && booking.status !== 'cancelled' ? `${inr(due)} due` : inr(rent)}
              </T>
            </Row>
            {deposit !== 'none' ? (
              <View style={{ marginTop: 6 }}>
                <Meta label={depositBadge(booking)} tone={DEPOSIT_STATE[deposit].tone} />
              </View>
            ) : null}
          </View>
        </Row>
      </Card>
    </Tap>
  );
}

export function BookingsScreen() {
  const nav = useNav();
  const role = useRole();
  const params = useParams<{ status: string }>();
  return (
    <ListScreen<Booking>
      title="Bookings"
      large
      path="/api/admin/bookings"
      listKey="bookings"
      bulk={BULK.bookings}
      trash={TRASH.bookings}
      filters={{ dateRange: { label: 'Rental dates overlapping' }, sorts: SORTS.bookings }}
      exporter={EXPORTS.bookings}
      menu={[
        { label: 'Calendar view', icon: 'Calendar', onPress: () => nav.navigate('BookingCalendar') },
        ...(canSettings(role)
          ? [{ label: 'Booking settings', icon: 'Settings', onPress: () => nav.navigate('Settings') }]
          : []),
      ]}
      chips={CHIPS}
      defaultChip={params.status ?? 'all'}
      counts={(meta) => meta?.statusCounts as Record<string, number> | undefined}
      search="Bill no., customer, phone, dress"
      onCreate={() => nav.navigate('BookingForm')}
      createLabel="Booking"
      top={(meta) => <SummaryStrip summary={meta?.summary as Record<string, unknown> | undefined} />}
      renderItem={(b) => (
        <BookingCard booking={b} onPress={() => nav.navigate('BookingDetail', { id: b._id })} />
      )}
      empty={{
        icon: 'CalendarCheck',
        title: 'No bookings',
        body: 'New rentals you create will show here.',
      }}
    />
  );
}
