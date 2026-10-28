import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { api, errorMessage } from '../../../api/client';
import { useApi, useInvalidate } from '../../../api/hooks';
import type { Booking, Category } from '../../../api/types';
import {
  Bars,
  Button,
  Card,
  Chips,
  DateField,
  Divider,
  ErrorState,
  Header,
  IconButton,
  Input,
  KV,
  Loading,
  MonthCalendar,
  MoneyInput,
  Pill,
  Row,
  Screen,
  Section,
  Segmented,
  SelectField,
  T,
  toast,
  type DayMark,
} from '../../../components/ui';
import { ProductPicker } from '../../../components/admin/Pickers';
import { BookingCard } from '../bookings/BookingsScreen';
import { alpha, colors, gradients, space, themed } from '../../../theme';
import { useNav } from '../../../navigation/nav';
import { fmtDate, inr, inrCompact, isoDay, num } from '../../../lib/format';
import { BOOKING_STATUS, INVOICE_STATUS, toneColor } from '../../../lib/labels';
import LinearGradient from 'react-native-linear-gradient';

// ======================= BOOKING CALENDAR ==================================

function monthBounds(d: Date) {
  return {
    from: isoDay(new Date(d.getFullYear(), d.getMonth(), 1)),
    to: isoDay(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  };
}

/** Month view of rentals — pickups, returns and dresses out on each day. */
export function BookingCalendarScreen() {
  const nav = useNav();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState(isoDay());
  const bounds = monthBounds(month);
  const q = useApi<{ bookings: Booking[] }>('/api/admin/bookings', {
    from: bounds.from,
    to: bounds.to,
    all: 'true',
    status: 'all',
  });
  const bookings = useMemo(() => (q.data?.bookings ?? []).filter((b) => b.status !== 'cancelled'), [q.data]);

  const marks = useMemo(() => {
    const m: Record<string, DayMark> = {};
    for (const b of bookings) {
      const start = isoDay(new Date(b.rentalStartDate));
      const end = isoDay(new Date(b.rentalEndDate));
      (m[start] ??= { dots: [] }).dots!.push(toneColor.gold);
      (m[end] ??= { dots: [] }).dots!.push(toneColor.rose);
      const cursor = new Date(b.rentalStartDate);
      const last = new Date(b.rentalEndDate);
      while (cursor <= last) {
        const k = isoDay(cursor);
        m[k] = { ...(m[k] ?? { dots: [] }), count: (m[k]?.count ?? 0) + 1 };
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    for (const k of Object.keys(m)) {
      const c = m[k].count ?? 0;
      if (c) m[k].fill = alpha(colors.gold, Math.min(0.08 + c * 0.06, 0.35));
    }
    return m;
  }, [bookings]);

  const onDay = bookings.filter(
    (b) => isoDay(new Date(b.rentalStartDate)) <= selected && isoDay(new Date(b.rentalEndDate)) >= selected
  );
  const pickups = onDay.filter((b) => isoDay(new Date(b.rentalStartDate)) === selected);
  const returns = onDay.filter((b) => isoDay(new Date(b.rentalEndDate)) === selected);

  return (
    <Screen
      header={
        <Header
          title="Booking calendar"
          right={
            <IconButton
              icon="Plus"
              onPress={() => nav.navigate('BookingForm')}
              accessibilityLabel="New booking"
            />
          }
        />
      }
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
    >
      <Card>
        <MonthCalendar
          month={month}
          onMonthChange={setMonth}
          marks={marks}
          selected={selected}
          onSelect={setSelected}
        />
        <Row style={{ marginTop: space.md, justifyContent: 'center' }} gap={space.lg}>
          <Row gap={6}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: toneColor.gold }} />
            <T variant="small">Pickup</T>
          </Row>
          <Row gap={6}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: toneColor.rose }} />
            <T variant="small">Return</T>
          </Row>
          <Row gap={6}>
            <View
              style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: alpha(colors.gold, 0.3) }}
            />
            <T variant="small">Dresses out</T>
          </Row>
        </Row>
      </Card>
      {q.isLoading ? <Loading /> : null}
      <Section title={`${fmtDate(selected)} · ${onDay.length} active`}>
        {pickups.length ? (
          <Pill label={`${pickups.length} pickup${pickups.length > 1 ? 's' : ''}`} tone="gold" small />
        ) : null}
        {returns.length ? (
          <Pill label={`${returns.length} return${returns.length > 1 ? 's' : ''}`} tone="rose" small />
        ) : null}
        <View style={{ marginTop: space.md }}>
          {onDay.length === 0 ? <T variant="small">No rentals on this day.</T> : null}
          {onDay.map((b) => (
            <BookingCard
              key={b._id}
              booking={b}
              onPress={() => nav.navigate('BookingDetail', { id: b._id })}
            />
          ))}
        </View>
      </Section>
    </Screen>
  );
}

// ============================ ANALYTICS ====================================

interface Analytics {
  bookingStatusBreakdown: { status: keyof typeof BOOKING_STATUS; count: number }[];
  invoiceStatusBreakdown: { status: keyof typeof INVOICE_STATUS; count: number; total: number }[];
  categoryRevenue: { category: string; revenue: number; bookings: number }[];
  topProducts: { name: string; bookings: number; revenue: number }[];
  monthlyTrend: { label: string; revenue: number; bookings: number; newCustomers: number }[];
}

const PRESETS = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_month_to_date', label: 'Last month to date' },
  { value: 'year', label: 'Year' },
  { value: 'custom', label: 'Custom' },
];

function Meter({
  label,
  value,
  max,
  right,
  color = colors.gold,
}: {
  label: string;
  value: number;
  max: number;
  right: string;
  color?: string;
}) {
  return (
    <View style={{ marginBottom: space.md }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T variant="small" color={colors.text}>
          {label}
        </T>
        <T variant="smallStrong">{right}</T>
      </Row>
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.surfaceHigh,
          marginTop: 6,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: 6,
            width: `${max ? (value / max) * 100 : 0}%`,
            backgroundColor: color,
            borderRadius: 3,
          }}
        />
      </View>
    </View>
  );
}

export function AnalyticsScreen() {
  const [preset, setPreset] = useState('month');
  const [from, setFrom] = useState(isoDay(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(isoDay());
  const [trendMetric, setTrendMetric] = useState<'revenue' | 'bookings' | 'newCustomers'>('revenue');
  const q = useApi<{ analytics: Analytics; rangeLabel: string }>('/api/admin/dashboard/analytics', {
    preset,
    ...(preset === 'custom' ? { from, to } : {}),
  });
  const a = q.data?.analytics;
  return (
    <Screen
      header={<Header title="Analytics" subtitle={q.data?.rangeLabel} />}
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
    >
      <Chips
        options={PRESETS}
        value={preset}
        onChange={setPreset}
        style={{ marginHorizontal: -space.lg, marginBottom: space.md }}
      />
      {preset === 'custom' ? (
        <Row gap={space.md}>
          <DateField label="From" value={from} onChange={setFrom} style={{ flex: 1 }} />
          <DateField label="To" value={to} onChange={setTo} style={{ flex: 1 }} />
        </Row>
      ) : null}
      {q.isLoading ? <Loading variant="stats" /> : null}
      {q.isError ? <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} /> : null}
      {a ? (
        <>
          <Card>
            <T variant="caption">12-month trend</T>
            <Segmented
              options={[
                { value: 'revenue', label: 'Revenue' },
                { value: 'bookings', label: 'Bookings' },
                { value: 'newCustomers', label: 'Customers' },
              ]}
              value={trendMetric}
              onChange={setTrendMetric}
            />
            <Bars
              data={a.monthlyTrend.map((m) => ({ label: m.label.split(' ')[0], value: m[trendMetric] }))}
              format={trendMetric === 'revenue' ? inrCompact : (v) => String(v)}
              height={140}
            />
          </Card>

          <Section title="Monthly detail">
            <Card padded={false}>
              <Row style={[monthStyles.row, monthStyles.head]}>
                <T variant="caption" style={{ flex: 1.2 }}>
                  Month
                </T>
                <T variant="caption" style={monthStyles.num}>
                  Bookings
                </T>
                <T variant="caption" style={monthStyles.num}>
                  Revenue
                </T>
                <T variant="caption" style={monthStyles.num}>
                  New cust.
                </T>
              </Row>
              {a.monthlyTrend.length === 0 ? (
                <T variant="small" style={{ padding: space.lg }}>
                  No data yet.
                </T>
              ) : null}
              {[...a.monthlyTrend].reverse().map((m) => (
                <Row key={m.label} style={monthStyles.row}>
                  <T variant="smallStrong" style={{ flex: 1.2 }}>
                    {m.label}
                  </T>
                  <T variant="small" style={monthStyles.num}>
                    {m.bookings}
                  </T>
                  <T variant="smallStrong" gold style={monthStyles.num}>
                    {inr(m.revenue)}
                  </T>
                  <T variant="small" style={monthStyles.num}>
                    {m.newCustomers}
                  </T>
                </Row>
              ))}
            </Card>
          </Section>

          <Section title="Booking status">
            <Card>
              {a.bookingStatusBreakdown.map((s) => (
                <Meter
                  key={s.status}
                  label={BOOKING_STATUS[s.status]?.label ?? s.status}
                  value={s.count}
                  max={Math.max(...a.bookingStatusBreakdown.map((x) => x.count), 1)}
                  right={String(s.count)}
                  color={toneColor[BOOKING_STATUS[s.status]?.tone ?? 'gold']}
                />
              ))}
            </Card>
          </Section>

          <Section title="Invoice status">
            <Card>
              {a.invoiceStatusBreakdown.map((s) => (
                <Meter
                  key={s.status}
                  label={`${INVOICE_STATUS[s.status]?.label ?? s.status} · ${s.count}`}
                  value={s.total}
                  max={Math.max(...a.invoiceStatusBreakdown.map((x) => x.total), 1)}
                  right={inr(s.total)}
                  color={toneColor[INVOICE_STATUS[s.status]?.tone ?? 'gold']}
                />
              ))}
            </Card>
          </Section>

          <Section title="Revenue by category">
            <Card>
              {a.categoryRevenue.length === 0 ? <T variant="small">No data for this period.</T> : null}
              {a.categoryRevenue.map((c) => (
                <Meter
                  key={c.category}
                  label={`${c.category} · ${c.bookings} bookings`}
                  value={c.revenue}
                  max={Math.max(...a.categoryRevenue.map((x) => x.revenue), 1)}
                  right={inr(c.revenue)}
                />
              ))}
            </Card>
          </Section>

          <Section title="Top 5 dresses">
            <Card>
              {a.topProducts.length === 0 ? <T variant="small">No data for this period.</T> : null}
              {a.topProducts.map((p, i) => (
                <Row key={p.name} style={{ paddingVertical: space.sm }}>
                  <LinearGradient
                    colors={[...gradients.primary]}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <T variant="smallStrong" color={colors.onPrimary}>
                      {i + 1}
                    </T>
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <T variant="bodyStrong" numberOfLines={1}>
                      {p.name}
                    </T>
                    <T variant="small">{p.bookings} bookings</T>
                  </View>
                  <T variant="bodyStrong">{inr(p.revenue)}</T>
                </Row>
              ))}
            </Card>
          </Section>
        </>
      ) : null}
    </Screen>
  );
}

// ========================= PURCHASE PARCEL =================================

interface ParcelLine {
  key: string;
  mode: 'existing' | 'new';
  product: string;
  name: string;
  category: string;
  color: string;
  fabric: string;
  sku: string;
  rent: string;
  size: string;
  quantity: string;
  unitCost: string;
}

const blankLine = (): ParcelLine => ({
  key: Math.random().toString(36).slice(2),
  mode: 'new',
  product: '',
  name: '',
  category: '',
  color: '',
  fabric: '',
  sku: '',
  rent: '',
  size: '',
  quantity: '1',
  unitCost: '',
});

/** One dealer bill with many dresses — existing ones restocked, new ones created in the catalogue. */
export function PurchaseParcelScreen() {
  const nav = useNav();
  const invalidate = useInvalidate();
  const cats = useApi<{ categories: Category[] }>('/api/admin/categories', { all: 'true' });
  const [f, setF] = useState({
    billNumber: '',
    vendorName: '',
    vendorContact: '',
    purchaseDate: isoDay(),
    paymentStatus: 'paid',
    amountPaid: '',
    notes: '',
  });
  const [lines, setLines] = useState<ParcelLine[]>([blankLine()]);
  const [busy, setBusy] = useState(false);
  const update = (key: string, patch: Partial<ParcelLine>) =>
    setLines((l) => l.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const total = lines.reduce((s, l) => s + (num(l.quantity) ?? 0) * (num(l.unitCost) ?? 0), 0);

  const submit = async () => {
    setBusy(true);
    try {
      await api.post('/api/admin/purchases/parcel', {
        ...f,
        amountPaid: f.paymentStatus === 'paid' ? total : num(f.amountPaid) ?? 0,
        items: lines.map((l) => ({
          mode: l.mode,
          product: l.mode === 'existing' ? l.product : '',
          name: l.mode === 'new' ? l.name : '',
          category: l.mode === 'new' ? l.category : '',
          color: l.color,
          fabric: l.fabric,
          sku: l.sku,
          rentalPricePerDay: num(l.rent),
          variantSize: l.size,
          quantity: Math.max(1, Math.round(num(l.quantity) ?? 1)),
          unitCost: num(l.unitCost) ?? 0,
        })),
      });
      invalidate('/api/admin/purchases', '/api/admin/products');
      toast.success('Parcel recorded', `${lines.length} line${lines.length > 1 ? 's' : ''} · ${inr(total)}`);
      nav.goBack();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      header={<Header title="Dealer parcel" subtitle="Several dresses on one bill" />}
      footer={<Button title={`Record parcel · ${inr(total)}`} onPress={submit} loading={busy} />}
    >
      <Row gap={space.md}>
        <Input
          label="Bill no."
          value={f.billNumber}
          onChangeText={(v) => setF({ ...f, billNumber: v })}
          required
          style={{ flex: 1 }}
        />
        <DateField
          label="Date"
          value={f.purchaseDate}
          onChange={(v) => setF({ ...f, purchaseDate: v })}
          style={{ flex: 1 }}
        />
      </Row>
      <Row gap={space.md}>
        <Input
          label="Dealer"
          value={f.vendorName}
          onChangeText={(v) => setF({ ...f, vendorName: v })}
          required
          style={{ flex: 1 }}
        />
        <Input
          label="Contact"
          value={f.vendorContact}
          onChangeText={(v) => setF({ ...f, vendorContact: v })}
          keyboardType="phone-pad"
          style={{ flex: 1 }}
        />
      </Row>
      <Section title="Dresses in this parcel" style={{ marginTop: space.sm }}>
        {lines.map((l, i) => (
          <Card key={l.key} style={{ marginBottom: space.md }}>
            <Row style={{ justifyContent: 'space-between', marginBottom: space.sm }}>
              <T variant="caption">Line {i + 1}</T>
              {lines.length > 1 ? (
                <IconButton
                  icon="X"
                  size={30}
                  onPress={() => setLines((s) => s.filter((x) => x.key !== l.key))}
                />
              ) : null}
            </Row>
            <Segmented
              options={[
                { value: 'new', label: 'New dress' },
                { value: 'existing', label: 'Restock existing' },
              ]}
              value={l.mode}
              onChange={(v) => update(l.key, { mode: v })}
            />
            {l.mode === 'existing' ? (
              <ProductPicker value={l.product} onChange={(pid) => update(l.key, { product: pid })} />
            ) : (
              <>
                <Input
                  label="Name"
                  value={l.name}
                  onChangeText={(v) => update(l.key, { name: v })}
                  required
                />
                <Row gap={space.md}>
                  <SelectField
                    label="Category"
                    required
                    value={l.category}
                    onChange={(v) => update(l.key, { category: v })}
                    options={(cats.data?.categories ?? []).map((c) => ({ value: c._id, label: c.name }))}
                    style={{ flex: 1 }}
                  />
                  <Input
                    label="Code"
                    hint="auto if blank"
                    value={l.sku}
                    onChangeText={(v) => update(l.key, { sku: v })}
                    autoCapitalize="characters"
                    style={{ flex: 1 }}
                  />
                </Row>
                <Row gap={space.md}>
                  <Input
                    label="Colour"
                    value={l.color}
                    onChangeText={(v) => update(l.key, { color: v })}
                    style={{ flex: 1 }}
                  />
                  <Input
                    label="Fabric"
                    value={l.fabric}
                    onChangeText={(v) => update(l.key, { fabric: v })}
                    style={{ flex: 1 }}
                  />
                </Row>
                <MoneyInput
                  label="Rent price"
                  value={l.rent}
                  onChangeText={(v) => update(l.key, { rent: v })}
                />
              </>
            )}
            <Row gap={space.md}>
              <Input
                label="Size"
                value={l.size}
                onChangeText={(v) => update(l.key, { size: v })}
                style={{ flex: 1 }}
              />
              <Input
                label="Qty"
                value={l.quantity}
                keyboardType="number-pad"
                onChangeText={(v) => update(l.key, { quantity: v })}
                style={{ flex: 1 }}
              />
              <MoneyInput
                label="Unit cost"
                value={l.unitCost}
                onChangeText={(v) => update(l.key, { unitCost: v })}
                style={{ flex: 1.4 }}
              />
            </Row>
          </Card>
        ))}
        <Button
          title="Add line"
          icon="Plus"
          variant="outline"
          onPress={() => setLines((s) => [...s, blankLine()])}
        />
      </Section>
      <Section title="Payment">
        <Segmented
          options={[
            { value: 'paid', label: 'Paid' },
            { value: 'partial', label: 'Partial' },
            { value: 'pending', label: 'Pending' },
          ]}
          value={f.paymentStatus}
          onChange={(v) => setF({ ...f, paymentStatus: v })}
        />
        {f.paymentStatus === 'partial' ? (
          <MoneyInput
            label="Amount paid"
            value={f.amountPaid}
            onChangeText={(v) => setF({ ...f, amountPaid: v })}
          />
        ) : null}
        <Input label="Notes" value={f.notes} onChangeText={(v) => setF({ ...f, notes: v })} multiline />
        <Divider />
        <KV label="Parcel total" value={inr(total)} strong />
      </Section>
    </Screen>
  );
}

const monthStyles = themed(() =>
  StyleSheet.create({
    row: {
      paddingHorizontal: space.lg,
      paddingVertical: space.sm + 2,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    head: { backgroundColor: colors.surface },
    num: { flex: 1, textAlign: 'right' },
  })
);
