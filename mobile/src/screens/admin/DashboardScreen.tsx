import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useApi } from '../../api/hooks';
import type { AppNotification, DashboardStats } from '../../api/types';
import {
  Avatar,
  Bars,
  Card,
  ErrorState,
  Icon,
  IconButton,
  ListRow,
  Loading,
  Pill,
  Row,
  Section,
  Segmented,
  Stat,
  T,
  Tap,
} from '../../components/ui';
import { colors, gradients, radius, space, themed } from '../../theme';
import { useAuth } from '../../auth/AuthContext';
import { useNav } from '../../navigation/nav';
import { inr, inrCompact, fmtRange } from '../../lib/format';
import { BOOKING_STATUS } from '../../lib/labels';
import { ROLE_LABELS, isManager } from '../../lib/roles';
import { errorMessage } from '../../api/client';
import { RefreshControl } from 'react-native';

function pct(now: number, before: number): number | null {
  if (!before) return null;
  return ((now - before) / before) * 100;
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** Text on the wine brand card (same in both themes, like the website's sign-in page). */
const ON_WINE = {
  text: '#FFFFFF',
  muted: 'rgba(255,255,255,0.72)',
  kicker: '#D9B876',
  up: '#9FD9AE',
  down: '#F2A79D',
};

export function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNav();
  const { user } = useAuth();
  const stats = useApi<DashboardStats>('/api/admin/dashboard');
  const notes = useApi<{
    notifications: AppNotification[];
    unreadCount: number;
  }>('/api/admin/notifications', { limit: 1 }, { refetchInterval: 30_000 });
  const s = stats.data;

  const quick = [
    { label: 'Booking', icon: 'CalendarCheck', route: 'BookingForm' },
    { label: 'Sale', icon: 'ShoppingBag', route: 'SaleForm' },
    { label: 'Stitching', icon: 'Ruler', route: 'CustomisationForm' },
    { label: 'Service', icon: 'Droplets', route: 'ServiceForm' },
    ...(isManager(user?.role) ? [{ label: 'Expense', icon: 'Receipt', route: 'Expenses' }] : []),
    { label: 'Customer', icon: 'Users', route: 'CustomerForm' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + space.md,
          paddingBottom: insets.bottom + 120,
        }}
        refreshControl={
          <RefreshControl
            refreshing={stats.isRefetching}
            onRefresh={() => {
              stats.refetch();
              notes.refetch();
            }}
            tintColor={colors.gold}
            colors={[colors.gold]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        <View style={styles.pad}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={space.md} style={{ flexShrink: 1 }}>
              <Tap onPress={() => nav.navigate('Account')}>
                <Avatar name={user?.name} size={44} gold />
              </Tap>
              <View style={{ flexShrink: 1 }}>
                <T variant="small">{greeting()},</T>
                {/* Name and role together, so the role reads as part of the greeting. */}
                <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
                  <T variant="h3" numberOfLines={1}>
                    {user?.name?.split(' ')[0]}
                  </T>
                  <Pill label={ROLE_LABELS[user?.role ?? 'staff']} tone="gold" small />
                </Row>
              </View>
            </Row>
            <Row>
              <IconButton icon="Search" onPress={() => nav.navigate('Search')} accessibilityLabel="Search" />
              <IconButton
                icon="Bell"
                badge={notes.data?.unreadCount}
                onPress={() => nav.navigate('Notifications')}
                accessibilityLabel="Notifications"
              />
            </Row>
          </Row>
        </View>

        {stats.isLoading ? (
          <Loading variant="stats" />
        ) : stats.isError || !s ? (
          <ErrorState message={errorMessage(stats.error)} onRetry={() => stats.refetch()} />
        ) : (
          <>
            {/* Hero: this month's revenue */}
            <View style={[styles.pad, { marginTop: space.xl }]}>
              <LinearGradient
                colors={[...gradients.wine]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.hero}
              >
                <T variant="caption" color={ON_WINE.kicker}>
                  Revenue this month
                </T>
                <T
                  variant="number"
                  color={ON_WINE.text}
                  style={{ marginTop: space.sm, fontSize: 38, lineHeight: 44 }}
                >
                  {inr(s.monthlyRevenueTotal)}
                </T>
                {pct(s.monthlyRevenueTotal, s.previousMonthRevenueTotal) !== null ? (
                  <Row style={{ marginTop: space.xs }}>
                    <Icon
                      name={
                        (pct(s.monthlyRevenueTotal, s.previousMonthRevenueTotal) ?? 0) >= 0
                          ? 'ArrowUpRight'
                          : 'ArrowDownRight'
                      }
                      size={16}
                      color={
                        (pct(s.monthlyRevenueTotal, s.previousMonthRevenueTotal) ?? 0) >= 0
                          ? ON_WINE.up
                          : ON_WINE.down
                      }
                    />
                    <T variant="small" color={ON_WINE.muted}>
                      {Math.abs(pct(s.monthlyRevenueTotal, s.previousMonthRevenueTotal) ?? 0).toFixed(0)}% vs
                      last month ({inr(s.previousMonthRevenueTotal)})
                    </T>
                  </Row>
                ) : null}
                <View style={{ marginTop: space.xl }}>
                  <Bars
                    data={s.monthlyRevenue.slice(-6).map((m) => ({
                      label: m.label.split(' ')[0],
                      value: m.revenue,
                    }))}
                    format={inrCompact}
                    height={110}
                    onDark
                  />
                </View>
              </LinearGradient>
            </View>

            {/* Today */}
            <View style={[styles.pad, { marginTop: space.lg }]}>
              <Row gap={space.sm}>
                {[
                  { label: 'Pickups', value: s.todaysPickups, icon: 'Package' },
                  {
                    label: 'Returns due',
                    value: s.todaysReturns,
                    icon: 'RotateCcw',
                  },
                  {
                    label: 'New today',
                    value: s.todaysBookings,
                    icon: 'Sparkles',
                  },
                ].map((item) => (
                  <Tap key={item.label} style={styles.today} onPress={() => nav.navigate('Bookings')}>
                    <Icon name={item.icon} size={18} color={colors.gold} />
                    <T variant="number" style={{ marginTop: space.sm }}>
                      {item.value}
                    </T>
                    <T variant="small">{item.label}</T>
                  </Tap>
                ))}
              </Row>
            </View>

            <PeriodPulse manager={isManager(user?.role)} />

            {/* Quick actions */}
            <Section title="Quick create" style={styles.pad}>
              <View style={styles.quickGrid}>
                {quick.map((q) => (
                  <Tap key={q.label} style={styles.quick} onPress={() => nav.navigate(q.route)}>
                    <LinearGradient colors={[...gradients.primary]} style={styles.quickIcon}>
                      <Icon name={q.icon} size={18} color={colors.onPrimary} strokeWidth={2} />
                    </LinearGradient>
                    <T variant="small" color={colors.text} numberOfLines={1}>
                      {q.label}
                    </T>
                  </Tap>
                ))}
              </View>
            </Section>

            {/* Needs attention */}
            {(s.overdueInvoicesCount > 0 ||
              s.returnsDue > 0 ||
              s.lowStockCount > 0 ||
              s.pendingPaymentsCount > 0) && (
              <Section title="Needs attention" style={styles.pad}>
                {s.returnsDue > 0 ? (
                  <ListRow
                    icon="RotateCcw"
                    title={`${s.returnsDue} returns overdue`}
                    subtitle="Picked-up dresses past their return date"
                    onPress={() => nav.navigate('Bookings', { status: 'in_use' })}
                  />
                ) : null}
                {s.overdueInvoicesCount > 0 ? (
                  <ListRow
                    icon="FileText"
                    title={`${s.overdueInvoicesCount} overdue invoices`}
                    subtitle={`${inr(s.overdueInvoicesTotal)} outstanding`}
                    onPress={() => nav.navigate('Invoices', { status: 'overdue' })}
                  />
                ) : null}
                {s.pendingPaymentsCount > 0 ? (
                  <ListRow
                    icon="Wallet"
                    title={`${s.pendingPaymentsCount} pending payments`}
                    subtitle={`${inr(s.outstandingBalance)} still to collect`}
                    onPress={() => nav.navigate('Invoices')}
                  />
                ) : null}
                {s.lowStockCount > 0 ? (
                  <ListRow
                    icon="Package"
                    title={`${s.lowStockCount} low-stock items`}
                    onPress={() => nav.navigate('Products')}
                  />
                ) : null}
              </Section>
            )}

            {/* KPIs */}
            <Section
              title="Analytics"
              action="Open"
              onAction={() => nav.navigate('Analytics')}
              style={styles.pad}
            >
              <ListRow
                icon="ChartBar"
                title="Status, category & top-dress analytics"
                subtitle="Booking/invoice breakdowns, revenue by category, 12-month trends"
                onPress={() => nav.navigate('Analytics')}
              />
              <ListRow
                icon="Calendar"
                title="Booking calendar"
                subtitle="Pickups, returns and dresses out by day"
                onPress={() => nav.navigate('BookingCalendar')}
              />
            </Section>

            <Section title="At a glance" style={styles.pad}>
              <View style={styles.grid}>
                <Stat
                  label="Active rentals"
                  value={String(s.activeRentals)}
                  icon="Shirt"
                  onPress={() => nav.navigate('Bookings', { status: 'in_use' })}
                />
                <Stat
                  label="Bookings / month"
                  value={String(s.bookingsThisMonth)}
                  icon="CalendarCheck"
                  delta={
                    pct(s.bookingsThisMonth, s.bookingsPreviousMonth) !== null
                      ? {
                          value: pct(s.bookingsThisMonth, s.bookingsPreviousMonth)!,
                        }
                      : null
                  }
                />
                <Stat
                  label="Available dresses"
                  value={String(s.availableDresses)}
                  icon="Sparkles"
                  onPress={() => nav.navigate('Products')}
                />
                <Stat
                  label="New customers"
                  value={String(s.newCustomersThisMonth)}
                  icon="Users"
                  delta={
                    pct(s.newCustomersThisMonth, s.newCustomersPreviousMonth) !== null
                      ? {
                          value: pct(s.newCustomersThisMonth, s.newCustomersPreviousMonth)!,
                        }
                      : null
                  }
                />
                <Stat label="Outstanding" value={inr(s.outstandingBalance)} icon="Wallet" />
                <Stat
                  label="Lifetime revenue"
                  value={inr(s.totalRevenue)}
                  icon="ChartBar"
                  onPress={() => nav.navigate('Reports')}
                />
              </View>
            </Section>

            {s.categoryBookingBreakdown.length > 0 ? (
              <Section title="Bookings by collection" style={styles.pad}>
                <Card>
                  {s.categoryBookingBreakdown.slice(0, 6).map((c) => {
                    const max = Math.max(...s.categoryBookingBreakdown.map((x) => x.bookings), 1);
                    return (
                      <View key={c.category} style={{ marginBottom: space.md }}>
                        <Row style={{ justifyContent: 'space-between' }}>
                          <T variant="small" color={colors.text}>
                            {c.category}
                          </T>
                          <T variant="smallStrong">{c.bookings}</T>
                        </Row>
                        <View style={styles.track}>
                          <LinearGradient
                            colors={[...gradients.primary]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[styles.fill, { width: `${(c.bookings / max) * 100}%` }]}
                          />
                        </View>
                      </View>
                    );
                  })}
                </Card>
              </Section>
            ) : null}

            <Section
              title="Recent bookings"
              action="See all"
              onAction={() => nav.navigate('Bookings')}
              style={styles.pad}
            >
              {s.recentBookings.map((b) => (
                <ListRow
                  key={b._id}
                  title={b.customer?.name ?? 'Walk-in'}
                  subtitle={b.productSummary}
                  meta={`${b.bookingNumber} · ${fmtRange(b.rentalStartDate, b.rentalEndDate)}`}
                  right={
                    <Pill
                      label={BOOKING_STATUS[b.status]?.label ?? b.status}
                      tone={BOOKING_STATUS[b.status]?.tone}
                      small
                    />
                  }
                  onPress={() => nav.navigate('BookingDetail', { id: b._id })}
                  chevron={false}
                />
              ))}
            </Section>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
] as const;
type Period = (typeof PERIODS)[number]['value'];

type Summary = Record<string, number | undefined>;

/**
 * Business pulse for today / this week / this month — straight from the
 * Reports API (same figures as the web Reports page): rent booked,
 * money collected, still outstanding, and (managers) costs and net profit.
 */
function PeriodPulse({ manager }: { manager: boolean }) {
  const nav = useNav();
  const [period, setPeriod] = React.useState<Period>('today');
  const q = { range: period, pageSize: 1 };
  const bookings = useApi<{ summary: Summary }>('/api/admin/reports', { ...q, type: 'bookings' });
  const invoices = useApi<{ summary: Summary }>('/api/admin/reports', { ...q, type: 'invoices' });
  const pl = useApi<{ summary: Summary }>(manager ? '/api/admin/reports' : null, {
    ...q,
    type: 'profit-loss',
  });
  const b = bookings.data?.summary;
  const i = invoices.data?.summary;
  const p = pl.data?.summary;
  const loading = bookings.isLoading || invoices.isLoading || (manager && pl.isLoading);
  const failed = bookings.isError || invoices.isError;

  const tiles: { label: string; value: string; tone?: string; hint?: string }[] = [
    { label: 'Rent booked', value: inr(b?.totalRevenue ?? 0), hint: `${b?.totalBookings ?? 0} bookings` },
    { label: 'Collected', value: inr(i?.totalCollected ?? 0), tone: colors.success, hint: 'on invoices' },
    {
      label: 'Outstanding',
      value: inr(i?.totalOutstanding ?? 0),
      tone: (i?.totalOutstanding ?? 0) > 0 ? colors.warning : undefined,
      hint: 'still to collect',
    },
  ];
  if (manager) {
    tiles.push(
      { label: 'Costs', value: inr(p?.totalCosts ?? 0), hint: 'expenses · salary · purchases' },
      {
        label: 'Net profit',
        value: inr(p?.netProfit ?? 0),
        tone: (p?.netProfit ?? 0) < 0 ? colors.danger : colors.gold,
        hint: p?.profitMargin ? `${Math.round(p.profitMargin)}% margin` : undefined,
      }
    );
  }

  return (
    <Section
      title="Business pulse"
      action="Reports"
      onAction={() => nav.navigate('Reports')}
      style={styles.pad}
    >
      <Segmented options={[...PERIODS]} value={period} onChange={setPeriod} />
      {failed ? (
        <ErrorState
          message={errorMessage(bookings.error ?? invoices.error)}
          onRetry={() => {
            bookings.refetch();
            invoices.refetch();
            pl.refetch();
          }}
        />
      ) : loading ? (
        <View style={{ marginTop: space.md }}>
          <Loading variant="stats" />
        </View>
      ) : (
        <View style={styles.pulseGrid}>
          {tiles.map((t) => (
            <View
              key={t.label}
              style={styles.pulseTile}
              accessible
              accessibilityLabel={`${t.label}: ${t.value}`}
            >
              <T variant="caption">{t.label}</T>
              <T
                variant="number"
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{ marginTop: 4, fontSize: 20, lineHeight: 26, color: t.tone ?? colors.text }}
              >
                {t.value}
              </T>
              {t.hint ? (
                <T variant="small" numberOfLines={1}>
                  {t.hint}
                </T>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </Section>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    pad: { paddingHorizontal: space.lg },
    hero: {
      borderRadius: radius.xl,
      padding: space.xl,
      boxShadow: '0 18px 40px rgba(40,8,26,0.28)',
    },
    today: {
      flex: 1,
      padding: space.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    pulseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
    pulseTile: {
      flexGrow: 1,
      flexBasis: '47%',
      padding: space.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    quick: {
      width: '31.5%',
      alignItems: 'center',
      gap: space.sm,
      paddingVertical: space.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    quickIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    track: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.surfaceHigh,
      marginTop: 6,
      overflow: 'hidden',
    },
    fill: { height: 6, borderRadius: 3 },
  })
);
