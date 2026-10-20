import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, errorMessage } from '../../../api/client';
import { useAction, useApi, useInvalidate, useList } from '../../../api/hooks';
import type { AppNotification, Enquiry, Review } from '../../../api/types';
import {
  Button,
  ToggleRow,
  DateField,
  SelectField,
  Card,
  Chips,
  Empty,
  ErrorState,
  Header,
  Icon,
  IconButton,
  Img,
  Input,
  ListRow,
  ListScreen,
  Loading,
  Pill,
  Row,
  Screen,
  SearchBar,
  ListSkeleton,
  Section,
  Stat,
  T,
  Tap,
  confirm,
  toast,
  useDebounced,
} from '../../../components/ui';
import { colors, fonts, radius, space, themed } from '../../../theme';
import { useNav, routeForLink } from '../../../navigation/nav';
import { fmtDate, fmtDateTime, inr, inrCompact, isoDay, relativeTime, titleCase } from '../../../lib/format';
import { BOOKING_STATUS, CUSTOMISATION_STATUS, INVOICE_STATUS, SERVICE_STATUS } from '../../../lib/labels';
import { exportTable, type ExportFormat } from '../../../lib/files';
import { call, openUrl, whatsapp } from '../../../lib/share';
import { useAuth, useRole } from '../../../auth/AuthContext';
import { canSettings, isManager } from '../../../lib/roles';

// =============================== REPORTS ===================================

const REPORT_TYPES = [
  { value: 'profit-loss', label: 'Profit & loss', manager: true },
  { value: 'bookings', label: 'Bookings' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'sale', label: 'Sales' },
  { value: 'customisation', label: 'Stitching' },
  { value: 'services', label: 'Services' },
  { value: 'products', label: 'Inventory' },
  { value: 'customers', label: 'Customers' },
  { value: 'pending-returns', label: 'Pending returns' },
];
const RANGES = [
  { value: 'custom', label: 'Custom' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_month_to_date', label: 'Last month to date' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All time' },
];

const MONEY_KEY =
  /(amount|revenue|total|cost|due|collected|value|profit|loss|invoiced|outstanding|paid|price|charge|earned)/i;
const TITLE_KEYS = [
  'label',
  'name',
  'customerName',
  'bookingNumber',
  'invoiceNumber',
  'billNumber',
  'description',
];

function humanKey(key: string) {
  return titleCase(key.replace(/([A-Z])/g, ' $1').trim());
}

function fmtValue(key: string, value: unknown): string {
  if (typeof value === 'number') {
    if (/margin|percent/i.test(key)) return `${value.toFixed(1)}%`;
    if (MONEY_KEY.test(key) && !/count|units|stock$/i.test(key)) return inr(value);
    return value.toLocaleString('en-IN');
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return fmtDate(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value && typeof value === 'object' && 'name' in (value as object))
    return String((value as { name: string }).name);
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

const STATUS_OPTIONS: Record<string, { value: string; label: string }[]> = {
  // The inventory report filters by record state, not dress status (same options as the web).
  products: [
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' },
    { value: 'trash', label: 'Trash' },
  ],
  bookings: Object.entries(BOOKING_STATUS).map(([value, v]) => ({ value, label: v.label })),
  invoices: Object.entries(INVOICE_STATUS).map(([value, v]) => ({ value, label: v.label })),
  services: Object.entries(SERVICE_STATUS).map(([value, v]) => ({ value, label: v.label })),
  customisation: Object.entries(CUSTOMISATION_STATUS).map(([value, v]) => ({ value, label: v.label })),
};

export function ReportsScreen() {
  const nav = useNav();
  const role = useRole();
  const types = REPORT_TYPES.filter((t) => !t.manager || isManager(role));
  const [type, setType] = useState(types[0].value);
  const [range, setRange] = useState('month');
  const [from, setFrom] = useState(isoDay(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(isoDay());
  const [status, setStatus] = useState('all');
  const [serviceType, setServiceType] = useState('all');
  const [exporting, setExporting] = useState(false);
  const query = {
    type,
    range,
    ...(range === 'custom' ? { from, to } : {}),
    ...(STATUS_OPTIONS[type] ? { status } : {}),
    ...(type === 'services' ? { serviceType } : {}),
  };
  const q = useApi<{
    summary: Record<string, unknown>;
    items: Record<string, unknown>[];
    range: { label: string };
  }>('/api/admin/reports', { ...query, pageSize: 50 });

  const remind = async (bookingId: string) => {
    try {
      await api.post(`/api/admin/bookings/${bookingId}/remind`);
      toast.success('Return reminder sent');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const runExport = async (format: ExportFormat | 'print') => {
    setExporting(true);
    try {
      const data = await api.get<{ items: Record<string, unknown>[]; summary: Record<string, unknown> }>(
        '/api/admin/reports',
        { ...query, all: 'true' }
      );
      const keys = Array.from(
        new Set(
          data.items.flatMap((it) =>
            Object.keys(it).filter((k) => k !== '_id' && (typeof it[k] !== 'object' || it[k] === null))
          )
        )
      );
      await exportTable({
        format,
        filename: `report-${type}`,
        title: `${types.find((t) => t.value === type)?.label ?? 'Report'} · ${q.data?.range.label ?? ''}`,
        headers: keys.map(humanKey),
        rows: data.items.map((it) =>
          keys.map((k) => (typeof it[k] === 'number' ? (it[k] as number) : fmtValue(k, it[k])))
        ),
      });
    } catch (e) {
      toast.error('Export failed', errorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header
        title="Reports"
        large
        subtitle={q.data?.range.label}
        right={
          <>
            <IconButton
              icon="ChartBar"
              onPress={() => nav.navigate('Analytics')}
              accessibilityLabel="Analytics"
            />
          </>
        }
      />
      <Chips
        options={types}
        value={type}
        onChange={(v) => {
          setType(v);
          setStatus('all');
        }}
        style={{ marginBottom: space.sm }}
      />
      {type !== 'pending-returns' ? (
        <Chips options={RANGES} value={range} onChange={setRange} style={{ marginBottom: space.md }} />
      ) : null}
      {q.isLoading ? (
        <Loading />
      ) : q.isError || !q.data ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 120 }}>
          {range === 'custom' && type !== 'pending-returns' ? (
            <Row gap={space.md}>
              <DateField label="From" value={from} onChange={setFrom} style={{ flex: 1 }} />
              <DateField label="To" value={to} onChange={setTo} style={{ flex: 1 }} />
            </Row>
          ) : null}
          {STATUS_OPTIONS[type] ? (
            <Row gap={space.md}>
              <SelectField
                label="Status"
                value={status}
                onChange={setStatus}
                options={[{ value: 'all', label: 'All statuses' }, ...STATUS_OPTIONS[type]]}
                style={{ flex: 1 }}
              />
              {type === 'services' ? (
                <SelectField
                  label="Service"
                  value={serviceType}
                  onChange={setServiceType}
                  options={[
                    { value: 'all', label: 'All' },
                    { value: 'dry_clean', label: 'Dry clean' },
                    { value: 'tailor', label: 'Tailor' },
                  ]}
                  style={{ flex: 1 }}
                />
              ) : null}
            </Row>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {Object.entries(q.data.summary)
              .filter(([, v]) => typeof v === 'number')
              .map(([k, v]) => (
                <Stat
                  key={k}
                  label={humanKey(k)}
                  value={MONEY_KEY.test(k) && !/margin/i.test(k) ? inrCompact(v as number) : fmtValue(k, v)}
                />
              ))}
          </View>
          <Row style={{ marginTop: space.lg }}>
            <Button
              title="CSV"
              icon="FileText"
              size="sm"
              variant="surface"
              onPress={() => runExport('csv')}
              loading={exporting}
            />
            <Button
              title="Excel"
              icon="FileText"
              size="sm"
              variant="surface"
              onPress={() => runExport('xlsx')}
              loading={exporting}
            />
            <Button
              title="PDF"
              icon="FileText"
              size="sm"
              variant="surface"
              onPress={() => runExport('pdf')}
              loading={exporting}
            />
            <Button
              title="Print"
              icon="Printer"
              size="sm"
              variant="surface"
              onPress={() => runExport('print')}
              loading={exporting}
            />
          </Row>
          <Section title={`Records · ${q.data.items.length}`}>
            {q.data.items.length === 0 ? <T variant="small">Nothing in this period.</T> : null}
            {q.data.items.map((item, i) => {
              const titleKey = TITLE_KEYS.find((k) => item[k]);
              const moneyKey = Object.keys(item).find(
                (k) => typeof item[k] === 'number' && MONEY_KEY.test(k)
              );
              const rest = Object.entries(item)
                .filter(
                  ([k, v]) =>
                    k !== titleKey &&
                    k !== moneyKey &&
                    k !== '_id' &&
                    v !== null &&
                    typeof v !== 'object' &&
                    v !== ''
                )
                .slice(0, 3)
                .map(([k, v]) => fmtValue(k, v));
              const amount = moneyKey ? (item[moneyKey] as number) : null;
              const id = typeof item._id === 'string' ? item._id : null;
              const open = id
                ? type === 'bookings' || type === 'pending-returns'
                  ? () => nav.navigate('BookingDetail', { id })
                  : type === 'invoices'
                  ? () => nav.navigate('InvoiceDetail', { id })
                  : type === 'sale'
                  ? () => nav.navigate('SaleDetail', { id })
                  : type === 'customisation'
                  ? () => nav.navigate('CustomisationDetail', { id })
                  : type === 'services'
                  ? () => nav.navigate('ServiceDetail', { id })
                  : type === 'products'
                  ? () => nav.navigate('ProductDetail', { id })
                  : type === 'customers'
                  ? () => nav.navigate('CustomerDetail', { id })
                  : undefined
                : undefined;
              return (
                <View key={String(item._id ?? i)}>
                  <ListRow
                    title={titleKey ? fmtValue(titleKey, item[titleKey]) : `#${i + 1}`}
                    subtitle={rest.join(' · ')}
                    right={
                      amount !== null ? (
                        <T variant="bodyStrong" color={amount < 0 ? colors.danger : colors.text}>
                          {inr(amount)}
                        </T>
                      ) : undefined
                    }
                    chevron={Boolean(open)}
                    onPress={open}
                  />
                  {type === 'pending-returns' && id ? (
                    <Button
                      title="Send return reminder"
                      icon="Send"
                      size="sm"
                      variant="ghost"
                      onPress={() => remind(id)}
                      style={{ alignSelf: 'flex-end', marginTop: -space.xs, marginBottom: space.sm }}
                    />
                  ) : null}
                </View>
              );
            })}
          </Section>
        </ScrollView>
      )}
    </View>
  );
}

// =============================== REVIEWS ===================================

export function ReviewsScreen() {
  const nav = useNav();
  return (
    <ListScreen<Review>
      title="Reviews"
      path="/api/admin/reviews"
      listKey="reviews"
      chipParam="rating"
      chips={[
        { value: '', label: 'All' },
        ...[5, 4, 3, 2, 1].map((r) => ({ value: String(r), label: `${r}★` })),
      ]}
      search="Customer or comment"
      renderItem={(r) => (
        <Card
          style={{ marginBottom: space.sm }}
          onPress={r.booking ? () => nav.navigate('BookingDetail', { id: r.booking!._id }) : undefined}
        >
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="bodyStrong">{r.customerName}</T>
            <Row gap={2}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Icon
                  key={n}
                  name="Star"
                  size={14}
                  color={n <= r.rating ? colors.gold : colors.borderStrong}
                  fill={n <= r.rating ? colors.gold : 'none'}
                />
              ))}
            </Row>
          </Row>
          {r.comment ? (
            <T variant="body" style={{ marginTop: space.sm }}>
              {r.comment}
            </T>
          ) : null}
          {r.images.length ? (
            <ScrollView horizontal style={{ marginTop: space.sm }} contentContainerStyle={{ gap: space.sm }}>
              {r.images.map((src) => (
                <Img key={src} src={src} style={{ width: 64, height: 64 }} />
              ))}
            </ScrollView>
          ) : null}
          <T variant="small" style={{ marginTop: space.sm }}>
            {fmtDate(r.createdAt)}
            {r.booking ? ` · ${r.booking.bookingNumber}` : ''}
          </T>
        </Card>
      )}
      empty={{
        icon: 'Star',
        title: 'No reviews yet',
        body: 'Ask customers for a review from a returned booking.',
      }}
    />
  );
}

// ============================== ENQUIRIES ==================================

export function EnquiriesScreen() {
  const invalidate = useInvalidate();
  const resolve = async (e: Enquiry, isResolved: boolean) => {
    try {
      await api.patch(`/api/admin/enquiries/${e._id}`, { isResolved });
      invalidate('/api/admin/enquiries');
      toast.success(isResolved ? 'Marked handled' : 'Reopened');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <ListScreen<Enquiry>
      title="Enquiries"
      subtitle="Dress requests from the app & website"
      path="/api/admin/enquiries"
      listKey="enquiries"
      search={false}
      chips={[
        { value: 'open', label: 'Open' },
        { value: 'resolved', label: 'Handled' },
        { value: 'all', label: 'All' },
      ]}
      renderItem={(e) => {
        const priority = e.message.includes('PRIVÉ');
        return (
          <Card style={{ marginBottom: space.sm, borderColor: priority ? colors.goldDeep : colors.border }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T variant="bodyStrong">{e.name}</T>
              {priority ? (
                <Pill label="Privé" tone="gold" small />
              ) : (
                <T variant="small">{relativeTime(e.createdAt)}</T>
              )}
            </Row>
            <T variant="small">{[e.phone, e.email].filter(Boolean).join(' · ')}</T>
            <T variant="body" style={{ marginTop: space.sm }}>
              {e.message.replace('★ PRIVÉ MEMBER — PRIORITY\n', '')}
            </T>
            <Row style={{ marginTop: space.md, flexWrap: 'wrap' }}>
              {e.phone ? (
                <Button title="Call" icon="Phone" size="sm" variant="surface" onPress={() => call(e.phone)} />
              ) : null}
              {e.phone ? (
                <Button
                  title="WhatsApp"
                  icon="MessageCircle"
                  size="sm"
                  variant="surface"
                  onPress={() =>
                    whatsapp(e.phone, `Hi ${e.name}, thank you for your enquiry with Color Times!`)
                  }
                />
              ) : null}
              <Button
                title={e.isResolved ? 'Reopen' : 'Done'}
                icon={e.isResolved ? 'RotateCcw' : 'Check'}
                size="sm"
                variant="outline"
                onPress={() => resolve(e, !e.isResolved)}
              />
            </Row>
          </Card>
        );
      }}
      empty={{ icon: 'Inbox', title: 'No open enquiries' }}
    />
  );
}

// ============================ NOTIFICATIONS ================================

export function NotificationsScreen() {
  const nav = useNav();
  const invalidate = useInvalidate();
  const q = useApi<{ notifications: AppNotification[]; unreadCount: number }>('/api/admin/notifications', {
    limit: 100,
  });
  const markAll = useAction(() => api.patch('/api/admin/notifications/mark-all-read'), {
    onSuccess: () => invalidate('/api/admin/notifications'),
  });
  const open = async (n: AppNotification) => {
    if (!n.isRead)
      api
        .patch(`/api/admin/notifications/${n._id}/read`)
        .then(() => invalidate('/api/admin/notifications'))
        .catch(() => {});
    const target = routeForLink(n.link);
    if (target) nav.navigate(target.name, target.params);
  };
  return (
    <Screen
      header={
        <Header
          title="Notifications"
          right={
            q.data?.unreadCount ? (
              <Button title="Mark all read" size="sm" variant="ghost" onPress={() => markAll.mutate()} />
            ) : undefined
          }
        />
      }
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
    >
      {q.isLoading ? <Loading /> : null}
      {q.data?.notifications.length === 0 ? <Empty icon="Bell" title="You're all caught up" /> : null}
      {q.data?.notifications.map((n) => (
        <Tap
          key={n._id}
          onPress={() => open(n)}
          style={[
            styles.note,
            !n.isRead && { borderColor: colors.goldDeep, backgroundColor: colors.accentBg },
          ]}
          scaleTo={0.99}
        >
          {!n.isRead ? <View style={styles.unreadDot} /> : null}
          <View style={{ flex: 1 }}>
            <T variant="bodyStrong">{n.title}</T>
            <T variant="small">{n.message}</T>
            <T variant="small" color={colors.textFaint} style={{ marginTop: 4 }}>
              {relativeTime(n.createdAt)}
            </T>
          </View>
        </Tap>
      ))}
    </Screen>
  );
}

// ================================ TRASH ====================================

const TRASH: {
  key: string;
  label: string;
  path: string;
  listKey: string;
  param: 'view' | 'status';
  title: (x: Record<string, unknown>) => string;
}[] = [
  {
    key: 'bookings',
    label: 'Bookings',
    path: '/api/admin/bookings',
    listKey: 'bookings',
    param: 'view',
    title: (x) => `${x.bookingNumber} · ${(x.customer as { name?: string })?.name ?? ''}`,
  },
  {
    key: 'invoices',
    label: 'Invoices',
    path: '/api/admin/invoices',
    listKey: 'invoices',
    param: 'view',
    title: (x) => String(x.invoiceNumber),
  },
  {
    key: 'products',
    label: 'Products',
    path: '/api/admin/products',
    listKey: 'products',
    param: 'status',
    title: (x) => `${x.name} (${x.sku})`,
  },
  {
    key: 'customers',
    label: 'Customers',
    path: '/api/admin/customers',
    listKey: 'customers',
    param: 'view',
    title: (x) => String(x.name),
  },
  {
    key: 'categories',
    label: 'Categories',
    path: '/api/admin/categories',
    listKey: 'categories',
    param: 'status',
    title: (x) => String(x.name),
  },
  {
    key: 'expenses',
    label: 'Expenses',
    path: '/api/admin/expenses',
    listKey: 'expenses',
    param: 'status',
    title: (x) => `${x.description} · ${inr(x.amount as number)}`,
  },
  {
    key: 'purchases',
    label: 'Purchases',
    path: '/api/admin/purchases',
    listKey: 'purchases',
    param: 'status',
    title: (x) => `${x.itemName} · ${x.vendorName}`,
  },
  {
    key: 'staff',
    label: 'Staff',
    path: '/api/admin/staff',
    listKey: 'staff',
    param: 'status',
    title: (x) => String(x.name),
  },
  {
    key: 'salaryPayments',
    label: 'Salaries',
    path: '/api/admin/salary-payments',
    listKey: 'payments',
    param: 'status',
    title: (x) => `${(x.staff as { name?: string })?.name ?? 'Staff'} · ${x.forMonth}`,
  },
];

export function TrashScreen() {
  const role = useRole();
  const invalidate = useInvalidate();
  const insets = useSafeAreaInsets();
  const counts = useApi<{ counts: Record<string, number> }>('/api/admin/trash/counts');
  const [tab, setTab] = useState(TRASH[0].key);
  const [text, setText] = useState('');
  const term = useDebounced(text);
  const [emptying, setEmptying] = useState(false);
  const def = TRASH.find((t) => t.key === tab)!;
  const list = useList<Record<string, unknown>>(
    def.path,
    def.listKey,
    { [def.param]: 'trash', search: term || undefined },
    20
  );
  const count = counts.data?.counts[def.key] ?? list.items.length;

  const act = async (id: string, permanent: boolean) => {
    if (
      permanent &&
      !(await confirm({
        title: 'Delete forever?',
        message: 'This cannot be undone.',
        confirmText: 'Delete forever',
        destructive: true,
      }))
    )
      return;
    try {
      if (permanent) await api.delete(`${def.path}/${id}/permanent`);
      else await api.post(`${def.path}/${id}/restore`);
      invalidate(def.path, '/api/admin/trash');
      toast.success(permanent ? 'Deleted permanently' : 'Restored');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  // Web "Empty Trash": permanently delete every trashed record of this kind.
  const emptyTrash = async () => {
    if (
      !(await confirm({
        title: `Empty ${def.label.toLowerCase()} trash?`,
        message:
          'Every trashed record here will be permanently deleted, even if bookings, invoices or other records still reference it. This cannot be undone.',
        confirmText: 'Empty Trash',
        destructive: true,
      }))
    )
      return;
    setEmptying(true);
    try {
      const all = await api.get<Record<string, unknown>>(def.path, { [def.param]: 'trash', all: 'true' });
      const ids = ((all[def.listKey] as { _id: string }[] | undefined) ?? []).map((x) => String(x._id));
      if (!ids.length) {
        toast.success('Trash is already empty');
        return;
      }
      const r = await api.post<{ deleted?: number; affected?: number }>(`${def.path}/bulk`, {
        ids,
        action: 'permanent-delete',
      });
      toast.success(`Emptied trash — deleted ${r.deleted ?? r.affected ?? ids.length}`);
      invalidate(def.path, '/api/admin/trash', '/api/admin/dashboard');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setEmptying(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Trash" subtitle="Restore or delete forever" />
      <Chips
        options={TRASH.map((t) => ({ value: t.key, label: t.label, count: counts.data?.counts[t.key] }))}
        value={tab}
        onChange={(v) => {
          setTab(v);
          setText('');
        }}
        style={{ marginBottom: space.md }}
      />
      <Row style={{ paddingHorizontal: space.lg, marginBottom: space.md }}>
        <SearchBar
          value={text}
          onChangeText={setText}
          placeholder={`Search trashed ${def.label.toLowerCase()}…`}
          style={{ flex: 1 }}
        />
        {isManager(role) && count > 0 ? (
          <Button
            title="Empty"
            icon="Trash"
            size="sm"
            variant="danger"
            onPress={emptyTrash}
            loading={emptying}
          />
        ) : null}
      </Row>
      {list.isLoading ? (
        <ListSkeleton inset />
      ) : (
        <FlatList
          data={list.items}
          keyExtractor={(x) => String(x._id)}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + 80 }}
          ListEmptyComponent={<Empty icon="Trash" title={term ? 'No matches' : 'Nothing in Trash'} />}
          onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={list.isRefetching && !list.isFetchingNextPage}
              onRefresh={() => {
                list.refetch();
                counts.refetch();
              }}
              tintColor={colors.gold}
            />
          }
          renderItem={({ item: x }) => (
            <Card style={{ marginBottom: space.sm }}>
              <T variant="bodyStrong">{def.title(x)}</T>
              {x.deletedAt ? <T variant="small">Trashed on {fmtDateTime(x.deletedAt as string)}</T> : null}
              <Row style={{ marginTop: space.md }}>
                <Button
                  title="Restore"
                  icon="Undo2"
                  size="sm"
                  variant="outline"
                  onPress={() => act(String(x._id), false)}
                />
                {isManager(role) ? (
                  <Button
                    title="Delete forever"
                    size="sm"
                    variant="danger"
                    onPress={() => act(String(x._id), true)}
                  />
                ) : null}
              </Row>
            </Card>
          )}
        />
      )}
    </View>
  );
}

// =============================== SEARCH ====================================

export function SearchScreen() {
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const q = useDebounced(text, 300);
  const r = useApi<{
    products: { _id: string; name: string; sku: string; images: string[] }[];
    customers: { _id: string; name: string; email: string; phone?: string }[];
    bookings: {
      _id: string;
      bookingNumber: string;
      status: keyof typeof BOOKING_STATUS;
      customer?: { name: string };
    }[];
    invoices: {
      _id: string;
      invoiceNumber: string;
      status: keyof typeof INVOICE_STATUS;
      customer?: { name: string };
    }[];
  }>(q.length >= 2 ? '/api/admin/search' : null, { q });
  const d = r.data;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + space.sm }}>
      <Row style={{ paddingHorizontal: space.lg, marginBottom: space.md }}>
        <SearchBar
          value={text}
          onChangeText={setText}
          placeholder="Search everything"
          autoFocus
          style={{ flex: 1 }}
        />
        <Button title="Cancel" variant="ghost" size="sm" onPress={() => nav.goBack()} />
      </Row>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 60 }}
      >
        {q.length < 2 ? (
          <Empty
            icon="Search"
            title="Find anything"
            body="Bookings, bills, customers, dresses — by name, number or phone."
          />
        ) : null}
        {r.isFetching && !d ? <Loading variant="list" /> : null}
        {d?.bookings.length ? (
          <Section title="Bookings" style={{ marginTop: space.md }}>
            {d.bookings.map((b) => (
              <ListRow
                key={b._id}
                icon="CalendarCheck"
                title={b.bookingNumber}
                subtitle={b.customer?.name}
                right={
                  <Pill
                    label={BOOKING_STATUS[b.status]?.label ?? b.status}
                    tone={BOOKING_STATUS[b.status]?.tone}
                    small
                  />
                }
                onPress={() => nav.navigate('BookingDetail', { id: b._id })}
              />
            ))}
          </Section>
        ) : null}
        {d?.customers.length ? (
          <Section title="Customers" style={{ marginTop: space.md }}>
            {d.customers.map((c) => (
              <ListRow
                key={c._id}
                icon="Users"
                title={c.name}
                subtitle={[c.phone, c.email].filter(Boolean).join(' · ')}
                onPress={() => nav.navigate('CustomerDetail', { id: c._id })}
              />
            ))}
          </Section>
        ) : null}
        {d?.products.length ? (
          <Section title="Dresses" style={{ marginTop: space.md }}>
            {d.products.map((p) => (
              <ListRow
                key={p._id}
                leading={<Img src={p.images[0]} style={{ width: 40, height: 50 }} rounded={6} />}
                title={p.name}
                subtitle={p.sku}
                onPress={() => nav.navigate('ProductDetail', { id: p._id })}
              />
            ))}
          </Section>
        ) : null}
        {d?.invoices.length ? (
          <Section title="Invoices" style={{ marginTop: space.md }}>
            {d.invoices.map((i) => (
              <ListRow
                key={i._id}
                icon="FileText"
                title={i.invoiceNumber}
                subtitle={i.customer?.name}
                right={
                  <Pill
                    label={INVOICE_STATUS[i.status]?.label ?? i.status}
                    tone={INVOICE_STATUS[i.status]?.tone}
                    small
                  />
                }
                onPress={() => nav.navigate('InvoiceDetail', { id: i._id })}
              />
            ))}
          </Section>
        ) : null}
        {d && !d.bookings.length && !d.customers.length && !d.products.length && !d.invoices.length ? (
          <Empty icon="Search" title="No matches" />
        ) : null}
      </ScrollView>
    </View>
  );
}

// =============================== SETTINGS ==================================

export function SettingsScreen() {
  const role = useRole();
  const editable = canSettings(role);
  const pm = useApi<{ settings: { options: string[] } }>('/api/admin/settings/payment-methods');
  const inv = useApi<{ settings: Record<string, unknown> }>('/api/admin/settings/inventory');
  const [methods, setMethods] = useState('');
  const [threshold, setThreshold] = useState('');
  const [prefix, setPrefix] = useState('');
  const [depositX, setDepositX] = useState('');
  const [retailX, setRetailX] = useState('');
  const [autoArchive, setAutoArchive] = useState(false);
  useEffect(() => {
    if (pm.data) setMethods(pm.data.settings.options.join(', '));
  }, [pm.data]);
  useEffect(() => {
    if (inv.data) {
      setThreshold(String(inv.data.settings.lowStockThreshold ?? ''));
      setPrefix(String(inv.data.settings.skuPrefix ?? ''));
      setDepositX(String(inv.data.settings.defaultSecurityDepositMultiplier ?? ''));
      setRetailX(String(inv.data.settings.defaultRetailValueMultiplier ?? ''));
      setAutoArchive(Boolean(inv.data.settings.autoArchiveOutOfStock));
    }
  }, [inv.data]);

  const savePm = useAction(
    () =>
      api.patch('/api/admin/settings/payment-methods', {
        options: methods
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean),
      }),
    { success: 'Payment methods saved' }
  );
  const saveInv = useAction(
    () =>
      api.patch('/api/admin/settings/inventory', {
        ...inv.data?.settings,
        lowStockThreshold: Number(threshold) || 0,
        skuPrefix: prefix,
        defaultSecurityDepositMultiplier: Number(depositX) || 0,
        defaultRetailValueMultiplier: Number(retailX) || 0,
        autoArchiveOutOfStock: autoArchive,
      }),
    { success: 'Inventory settings saved' }
  );

  return (
    <Screen header={<Header title="Business settings" />}>
      {!editable ? (
        <Card style={{ marginBottom: space.lg }}>
          <T variant="small">Only Developer / Super Admin accounts can change these.</T>
        </Card>
      ) : null}
      <Section title="Payment methods" style={{ marginTop: 0 }}>
        <Input
          label="Options"
          hint="comma separated"
          value={methods}
          onChangeText={setMethods}
          editable={editable}
        />
        {editable ? (
          <Button title="Save" variant="outline" onPress={() => savePm.mutate()} loading={savePm.isPending} />
        ) : null}
      </Section>
      <Section title="Inventory">
        <Input
          label="Low-stock threshold"
          value={threshold}
          onChangeText={setThreshold}
          keyboardType="number-pad"
          editable={editable}
        />
        <Input
          label="Code prefix"
          value={prefix}
          onChangeText={setPrefix}
          autoCapitalize="characters"
          editable={editable}
        />
        <Row gap={space.md}>
          <Input
            label="Deposit × rent"
            hint="default"
            value={depositX}
            onChangeText={setDepositX}
            keyboardType="decimal-pad"
            editable={editable}
            style={{ flex: 1 }}
          />
          <Input
            label="Retail × rent"
            hint="default"
            value={retailX}
            onChangeText={setRetailX}
            keyboardType="decimal-pad"
            editable={editable}
            style={{ flex: 1 }}
          />
        </Row>
        <ToggleRow
          label="Auto-archive when out of stock"
          value={autoArchive}
          onChange={(v) => editable && setAutoArchive(v)}
        />
        {editable ? (
          <Button
            title="Save"
            variant="outline"
            onPress={() => saveInv.mutate()}
            loading={saveInv.isPending}
          />
        ) : null}
      </Section>
    </Screen>
  );
}

// ================================ MORE =====================================

/**
 * Everything in the web portal's sidebar, in the same groups and order
 * (lib/config/admin-nav.ts), plus the top-bar items (search, notifications,
 * account, trash, view website, log out). The tab bar covers Dashboard,
 * Bookings, Products and Invoices; they're listed here too so the menu reads
 * exactly like the portal.
 */
export function MoreScreen() {
  const nav = useNav();
  const role = useRole();
  const { signOut } = useAuth();
  const enquiries = useApi<{ openCount: number }>('/api/admin/enquiries', { pageSize: 1 });
  const unread = useApi<{ unreadCount: number }>(
    '/api/admin/notifications',
    { pageSize: 1 },
    { refetchInterval: 30_000 }
  );
  const manager = isManager(role);
  const settings = canSettings(role);

  const viewWebsite = async () => {
    // Same rule as the portal's "View Website": the public site is locked to developers while in progress.
    if (role !== 'developer') {
      await confirm({
        title: 'Website access locked',
        message:
          'Viewing the public website from the admin is currently locked. Please connect with your administrator for access.',
        confirmText: 'OK',
        cancelText: 'Close',
      });
      return;
    }
    openUrl(api.url('/home'));
  };

  const groups: {
    title: string;
    items: {
      label: string;
      icon: string;
      onPress: () => void;
      show?: boolean;
      badge?: number;
      subtitle?: string;
    }[];
  }[] = [
    {
      title: 'Overview',
      items: [
        { label: 'Dashboard', icon: 'LayoutDashboard', onPress: () => nav.navigate('Dashboard') },
        {
          label: 'Analytics',
          icon: 'ChartBar',
          onPress: () => nav.navigate('Analytics'),
          subtitle: 'Status, category, top dresses, trends',
        },
        {
          label: 'Search',
          icon: 'Search',
          onPress: () => nav.navigate('Search'),
          subtitle: 'Bill no., dress code, customer, mobile',
        },
        {
          label: 'Notifications',
          icon: 'Bell',
          onPress: () => nav.navigate('Notifications'),
          badge: unread.data?.unreadCount,
        },
      ],
    },
    {
      title: 'Inventory',
      items: [
        { label: 'Categories', icon: 'FolderTree', onPress: () => nav.navigate('Categories') },
        { label: 'Products', icon: 'Shirt', onPress: () => nav.navigate('Catalogue') },
        {
          label: 'Inventory settings',
          icon: 'Settings',
          onPress: () => nav.navigate('Settings'),
          show: settings,
        },
      ],
    },
    {
      title: 'Rentals',
      items: [
        { label: 'Bookings', icon: 'CalendarCheck', onPress: () => nav.navigate('BookingsTab') },
        { label: 'Booking calendar', icon: 'Calendar', onPress: () => nav.navigate('BookingCalendar') },
        {
          label: 'Enquiries',
          icon: 'Inbox',
          onPress: () => nav.navigate('Enquiries'),
          badge: enquiries.data?.openCount,
        },
        { label: 'Reviews', icon: 'Star', onPress: () => nav.navigate('Reviews') },
        { label: 'Sale', icon: 'ShoppingBag', onPress: () => nav.navigate('Sales') },
        { label: 'Dry clean & tailor', icon: 'Sparkles', onPress: () => nav.navigate('Services') },
        { label: 'Customisation', icon: 'Ruler', onPress: () => nav.navigate('Customisation') },
        {
          label: 'Booking settings',
          icon: 'Settings',
          onPress: () => nav.navigate('Settings'),
          show: settings,
          subtitle: 'Payment methods',
        },
      ],
    },
    {
      title: 'Billing',
      items: [
        { label: 'Invoices', icon: 'FileText', onPress: () => nav.navigate('Billing') },
        { label: 'Reports', icon: 'ChartBar', onPress: () => nav.navigate('Reports') },
      ],
    },
    {
      title: 'People',
      items: [
        { label: 'Customers', icon: 'Users', onPress: () => nav.navigate('Customers') },
        { label: 'Team', icon: 'UserCog', onPress: () => nav.navigate('Team'), show: manager },
      ],
    },
    {
      title: 'Finance',
      items: [
        {
          label: 'Staff',
          icon: 'IdCard',
          onPress: () => nav.navigate('Staff'),
          show: manager,
          subtitle: 'Staff and salary payments',
        },
        { label: 'Expenses', icon: 'Receipt', onPress: () => nav.navigate('Expenses'), show: manager },
        { label: 'Purchases', icon: 'PackagePlus', onPress: () => nav.navigate('Purchases'), show: manager },
      ],
    },
    {
      title: 'Marketing',
      items: [
        { label: 'WhatsApp', icon: 'MessageCircle', onPress: () => nav.navigate('WhatsApp'), show: settings },
      ],
    },
    {
      title: 'Account',
      items: [
        {
          label: 'Account settings',
          icon: 'UserCog',
          onPress: () => nav.navigate('Account'),
          subtitle: 'Profile, password, appearance, Face ID',
        },
        { label: 'Trash', icon: 'Trash', onPress: () => nav.navigate('Trash') },
        { label: 'View website', icon: 'ExternalLink', onPress: viewWebsite },
        {
          label: 'Log out',
          icon: 'LogOut',
          onPress: async () => {
            if (
              await confirm({ title: 'Log out of Color Times?', confirmText: 'Log out', destructive: true })
            )
              signOut();
          },
        },
      ],
    },
  ];
  return (
    <Screen header={<Header title="More" large back={false} />}>
      {groups.map((g) => {
        const items = g.items.filter((i) => i.show !== false);
        if (!items.length) return null;
        return (
          <Section key={g.title} title={g.title} style={{ marginTop: space.lg }}>
            {items.map((i) => (
              <ListRow
                key={i.label}
                icon={i.icon}
                title={i.label}
                subtitle={i.subtitle}
                right={i.badge ? <Pill label={String(i.badge)} small /> : undefined}
                onPress={i.onPress}
              />
            ))}
          </Section>
        );
      })}
    </Screen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    note: {
      flexDirection: 'row',
      gap: space.md,
      padding: space.md,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginBottom: space.sm,
    },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold, marginTop: 7 },
    bubble: {
      maxWidth: '82%',
      paddingVertical: space.sm,
      paddingHorizontal: space.md,
      borderRadius: radius.lg,
    },
    mine: { alignSelf: 'flex-end', backgroundColor: colors.gold, borderBottomRightRadius: 4 },
    theirs: { alignSelf: 'flex-start', backgroundColor: colors.surfaceHigh, borderBottomLeftRadius: 4 },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: space.sm,
      paddingHorizontal: space.lg,
      paddingTop: space.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.bgElevated,
    },
    composerInput: {
      flex: 1,
      maxHeight: 120,
      minHeight: 42,
      color: colors.text,
      fontFamily: fonts.body,
      fontSize: 15,
      paddingHorizontal: space.md,
      paddingVertical: 10,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
    },
  })
);
