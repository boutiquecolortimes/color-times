import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api, errorMessage } from '../../../api/client';
import { useAction, useApi, useInvalidate } from '../../../api/hooks';
import type { Booking, Customer } from '../../../api/types';
import {
  Avatar,
  Button,
  Card,
  ErrorState,
  Header,
  IconButton,
  Input,
  KV,
  ListRow,
  ListScreen,
  Loading,
  Pill,
  Row,
  Screen,
  Section,
  T,
  confirm,
  toast,
} from '../../../components/ui';
import { BookingCard } from '../bookings/BookingsScreen';
import { ImportSheet } from '../../../components/admin/ImportSheet';
import { colors, space } from '../../../theme';
import { MeasurementsView } from '../../../components/admin/Pickers';
import { MEASUREMENT_FIELDS } from '../../../lib/labels';
import { bookingRemainingDue } from '../../../lib/bookingMoney';
import { useNav, useParams } from '../../../navigation/nav';
import { fmtDate, inr, isoDay } from '../../../lib/format';
import { call, whatsapp } from '../../../lib/share';
import { useRole } from '../../../auth/AuthContext';
import { isManager } from '../../../lib/roles';
import { BULK, EXPORTS, SORTS, TRASH } from '../listConfig';
import { AuditHistory } from '../../../components/admin/AuditHistory';

export function CustomersScreen() {
  const nav = useNav();
  const [importing, setImporting] = useState(false);
  return (
    <>
      <ImportSheet
        visible={importing}
        onClose={() => setImporting(false)}
        title="Import customers"
        endpoint="/api/admin/customers/import"
        invalidatePath="/api/admin/customers"
        sample={[
          'Priya Sharma',
          'priya.sharma@example.com',
          '9876543210',
          'Rajesh Sharma',
          '12 MG Road',
          'Bengaluru',
          'Karnataka',
          '560001',
        ]}
        columns={[
          'name',
          'email',
          'phone',
          'fatherName',
          'addressLine1',
          'addressCity',
          'addressState',
          'addressPostalCode',
        ]}
      />
      <ListScreen<Customer>
        title="Customers"
        path="/api/admin/customers"
        listKey="customers"
        bulk={BULK.customers}
        trash={TRASH.customers}
        filters={{ sorts: SORTS.customers }}
        exporter={EXPORTS.customers}
        menu={[{ label: 'Import customers', icon: 'Download', onPress: () => setImporting(true) }]}
        search="Name, phone or email"
        onCreate={() => nav.navigate('CustomerForm')}
        createLabel="Customer"
        renderItem={(c) => (
          <ListRow
            leading={<Avatar name={c.name} />}
            title={c.name}
            subtitle={[c.phone, c.email].filter(Boolean).join(' · ')}
            meta={c.addresses?.[0]?.line1 || undefined}
            onPress={() => nav.navigate('CustomerDetail', { id: c._id })}
          />
        )}
        empty={{ icon: 'Users', title: 'No customers yet' }}
      />
    </>
  );
}

export function CustomerDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const nav = useNav();
  const role = useRole();
  const invalidate = useInvalidate();
  const q = useApi<{ customer: Customer; bookings: Booking[] }>(id ? `/api/admin/customers/${id}` : null);
  const archive = useAction(
    (action: 'archive' | 'restore') => api.post(`/api/admin/customers/${id}/${action}`),
    {
      success: 'Updated',
      onSuccess: () => {
        invalidate('/api/admin/customers');
      },
    }
  );
  const remove = useAction(() => api.delete(`/api/admin/customers/${id}`), {
    success: 'Customer moved to Trash',
    onSuccess: () => {
      invalidate('/api/admin/customers');
      nav.goBack();
    },
  });

  if (q.isLoading)
    return (
      <Screen header={<Header title="Customer" />}>
        <Loading />
      </Screen>
    );
  if (!q.data)
    return (
      <Screen header={<Header title="Customer" />}>
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      </Screen>
    );
  const { customer: c, bookings } = q.data;
  const active = bookings.filter((b) => !b.deletedAt);
  const lifetime = active
    .filter((b) => b.status !== 'cancelled')
    .reduce((s, b) => s + (b.totalAmount - b.securityDeposit), 0);
  const outstanding = active
    .filter((b) => b.status !== 'cancelled')
    .reduce((s, b) => s + bookingRemainingDue(b), 0);
  const today = isoDay();
  // Next pickups, and dresses currently out (with their return date).
  const upcoming = active
    .filter(
      (b) =>
        b.status === 'in_use' ||
        (['inquiry', 'pending_payment', 'confirmed'].includes(b.status) &&
          isoDay(new Date(b.rentalStartDate)) >= today)
    )
    .sort((a, b) => +new Date(a.rentalStartDate) - +new Date(b.rentalStartDate));

  return (
    <Screen
      header={
        <Header
          title=""
          right={
            isManager(role) ? (
              <IconButton
                icon="Pencil"
                onPress={() => nav.navigate('CustomerForm', { id: c._id })}
                accessibilityLabel="Edit"
              />
            ) : undefined
          }
        />
      }
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
      footer={
        <Button
          title="New booking"
          icon="CalendarCheck"
          onPress={() =>
            nav.navigate('BookingForm', {
              customerId: c._id,
              customerName: c.name,
            })
          }
        />
      }
    >
      <View style={{ alignItems: 'center' }}>
        <Avatar name={c.name} size={84} gold />
        <T variant="h1" style={{ marginTop: space.md }} align="center">
          {c.name}
        </T>
        <T variant="small">Customer since {fmtDate(c.createdAt)}</T>
        {c.phone ? (
          <Row style={{ marginTop: space.lg }} gap={space.md}>
            <Button title="Call" icon="Phone" variant="surface" size="sm" onPress={() => call(c.phone)} />
            <Button
              title="WhatsApp"
              icon="MessageCircle"
              variant="surface"
              size="sm"
              onPress={() => whatsapp(c.phone)}
            />
          </Row>
        ) : null}
      </View>
      <Row gap={space.sm} style={{ marginTop: space.xl }}>
        <Card style={{ flex: 1 }}>
          <T variant="caption">Bookings</T>
          <T variant="number">{active.length}</T>
        </Card>
        <Card style={{ flex: 1 }}>
          <T variant="caption">Lifetime rent</T>
          <T variant="number" numberOfLines={1} adjustsFontSizeToFit>
            {inr(lifetime)}
          </T>
        </Card>
      </Row>
      <Card style={{ marginTop: space.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <T variant="caption">Outstanding</T>
            <T variant="number" color={outstanding > 0 ? colors.warning : colors.success}>
              {inr(outstanding)}
            </T>
          </View>
          <Pill
            label={outstanding > 0 ? 'Balance due' : 'All settled'}
            tone={outstanding > 0 ? 'warning' : 'success'}
          />
        </Row>
      </Card>
      {upcoming.length ? (
        <Section title="Upcoming">
          {upcoming.map((b) => (
            <ListRow
              key={b._id}
              icon={b.status === 'in_use' ? 'RotateCcw' : 'Package'}
              title={
                b.status === 'in_use'
                  ? `Return due ${fmtDate(b.rentalEndDate)}`
                  : `Pickup ${fmtDate(b.rentalStartDate)}`
              }
              subtitle={`#${b.billNumber || b.bookingNumber} · ${b.items
                .map((i) => i.product?.name)
                .filter(Boolean)
                .join(', ')}`}
              onPress={() => nav.navigate('BookingDetail', { id: b._id })}
            />
          ))}
        </Section>
      ) : null}
      <MeasurementBook bookings={active} customerName={c.name} />
      <Section title="Contact">
        <Card>
          <KV label="Email" value={c.email} />
          <KV label="Phone" value={c.phone || '—'} />
          {c.fatherName ? <KV label="Father / husband" value={c.fatherName} /> : null}
          {c.addresses?.[0] ? (
            <KV
              label="Address"
              value={[
                c.addresses[0].line1,
                c.addresses[0].city,
                c.addresses[0].state,
                c.addresses[0].postalCode,
              ]
                .filter(Boolean)
                .join(', ')}
            />
          ) : null}
        </Card>
      </Section>
      <Section title="Bookings">
        {active.length === 0 ? <T variant="small">No bookings yet.</T> : null}
        {active.map((b) => (
          <BookingCard
            key={b._id}
            booking={{
              ...b,
              customer: { _id: c._id, name: c.name, email: c.email },
            }}
            onPress={() => nav.navigate('BookingDetail', { id: b._id })}
          />
        ))}
      </Section>
      <AuditHistory entityType="Customer" entityId={c._id} />
      {isManager(role) ? (
        <Section title="Manage">
          <ListRow
            icon={c.isActive === false ? 'Undo2' : 'Archive'}
            title={c.isActive === false ? 'Unarchive customer' : 'Archive customer'}
            subtitle={
              c.isActive === false
                ? 'Currently archived — hidden from pickers'
                : 'Hide from pickers without deleting'
            }
            onPress={() => archive.mutate(c.isActive === false ? 'restore' : 'archive')}
          />
          <ListRow
            icon="Trash"
            danger
            title="Move customer to Trash"
            onPress={async () => {
              if (
                await confirm({
                  title: `Remove ${c.name}?`,
                  message: 'Their bookings stay intact. Restore any time from Trash.',
                  confirmText: 'Move to Trash',
                  destructive: true,
                })
              )
                remove.mutate();
            }}
          />
        </Section>
      ) : null}
    </Screen>
  );
}

export function CustomerFormScreen() {
  const { id, returnTo } = useParams<{ id: string; returnTo: string }>();
  const editing = Boolean(id);
  const nav = useNav();
  const invalidate = useInvalidate();
  const q = useApi<{ customer: Customer }>(id ? `/api/admin/customers/${id}` : null);
  const [f, setF] = useState({
    name: '',
    email: '',
    phone: '',
    fatherName: '',
    addressLine1: '',
    addressCity: '',
    addressState: '',
    addressPostalCode: '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    const c = q.data?.customer;
    if (!c) return;
    const a = c.addresses?.[0];
    setF({
      name: c.name,
      email: c.email,
      phone: c.phone ?? '',
      fatherName: c.fatherName ?? '',
      addressLine1: a?.line1 ?? '',
      addressCity: a?.city ?? '',
      addressState: a?.state ?? '',
      addressPostalCode: a?.postalCode ?? '',
    });
  }, [q.data]);

  const submit = async () => {
    if (!f.name.trim()) return toast.error('Name is required');
    if (!editing && !f.email.includes('@')) return toast.error('Enter a valid email');
    setBusy(true);
    try {
      const { email, ...rest } = f;
      const phone = f.phone.replace(/\D/g, '');
      const result = editing
        ? await api.patch<{ customer: Customer }>(`/api/admin/customers/${id}`, { ...rest, phone })
        : await api.post<{ customer: Customer }>('/api/admin/customers', {
            ...rest,
            email: email.trim().toLowerCase(),
            phone,
          });
      invalidate('/api/admin/customers');
      toast.success(editing ? 'Customer updated' : 'Customer added');
      if (returnTo)
        nav.popTo(
          returnTo,
          {
            customerId: result.customer._id,
            customerName: result.customer.name,
          },
          { merge: true }
        );
      else if (editing) nav.goBack();
      else nav.replace('CustomerDetail', { id: result.customer._id });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (editing && q.isLoading)
    return (
      <Screen header={<Header title="Edit customer" />}>
        <Loading />
      </Screen>
    );

  return (
    <Screen
      header={<Header title={editing ? 'Edit customer' : 'New customer'} />}
      footer={<Button title={editing ? 'Save' : 'Add customer'} onPress={submit} loading={busy} />}
    >
      <Input label="Full name" value={f.name} onChangeText={set('name')} required autoCapitalize="words" />
      <Input
        label="Email"
        value={f.email}
        onChangeText={set('email')}
        required={!editing}
        editable={!editing}
        keyboardType="email-address"
        autoCapitalize="none"
        hint={editing ? 'Login email · fixed' : undefined}
      />
      <Input
        label="Mobile"
        value={f.phone}
        onChangeText={set('phone')}
        keyboardType="phone-pad"
        prefix="+91"
      />
      <Input
        label="Father / husband name"
        value={f.fatherName}
        onChangeText={set('fatherName')}
        autoCapitalize="words"
      />
      <Section title="Address">
        <Input label="Address" value={f.addressLine1} onChangeText={set('addressLine1')} multiline />
        <Row gap={space.md}>
          <Input label="City" value={f.addressCity} onChangeText={set('addressCity')} style={{ flex: 1 }} />
          <Input
            label="PIN"
            value={f.addressPostalCode}
            onChangeText={set('addressPostalCode')}
            keyboardType="number-pad"
            style={{ flex: 1 }}
          />
        </Row>
        <Input label="State" value={f.addressState} onChangeText={set('addressState')} />
      </Section>
    </Screen>
  );
}

// ---------------------------------------------------------------------------

/**
 * Measurement book: every set of measurements taken on this customer's
 * bookings, grouped by wearer, newest first, with the change from the
 * previous visit. Read-only — measurements are edited on the booking itself.
 */
function MeasurementBook({ bookings, customerName }: { bookings: Booking[]; customerName: string }) {
  const nav = useNav();
  const [compare, setCompare] = useState<string | null>(null);
  const byWearer = new Map<
    string,
    { date: string; bookingId: string; ref: string; values: Record<string, string | undefined> }[]
  >();
  for (const b of bookings) {
    for (const item of b.items) {
      const values = item.measurements as Record<string, string | undefined> | undefined;
      if (!values || !MEASUREMENT_FIELDS.some((f) => values[f.key])) continue;
      const wearer = item.wearerName?.trim() || customerName;
      const list = byWearer.get(wearer) ?? [];
      list.push({ date: b.bookingDate, bookingId: b._id, ref: b.billNumber || b.bookingNumber, values });
      byWearer.set(wearer, list);
    }
  }
  if (!byWearer.size) return null;
  return (
    <Section title="Measurement book">
      {[...byWearer.entries()].map(([wearer, list]) => {
        const sorted = [...list].sort((a, b) => +new Date(b.date) - +new Date(a.date));
        const [latest, previous] = sorted;
        const showing = compare === wearer && previous;
        return (
          <Card key={wearer} style={{ marginBottom: space.sm }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <T variant="bodyStrong">{wearer}</T>
                <T variant="small">
                  Latest {fmtDate(latest.date)} · #{latest.ref}
                  {sorted.length > 1 ? ` · ${sorted.length} records` : ''}
                </T>
              </View>
              {previous ? (
                <Button
                  title={showing ? 'Hide changes' : 'Compare'}
                  size="sm"
                  variant="ghost"
                  onPress={() => setCompare(showing ? null : wearer)}
                />
              ) : null}
            </Row>
            <View style={{ marginTop: space.md }}>
              {showing ? (
                <MeasurementDiff current={latest.values} previous={previous.values} since={previous.date} />
              ) : (
                <MeasurementsView value={latest.values} />
              )}
            </View>
            <Button
              title="Open booking"
              size="sm"
              variant="ghost"
              style={{ alignSelf: 'flex-start', marginTop: space.sm, marginLeft: -space.sm }}
              onPress={() => nav.navigate('BookingDetail', { id: latest.bookingId })}
            />
          </Card>
        );
      })}
    </Section>
  );
}

function MeasurementDiff({
  current,
  previous,
  since,
}: {
  current: Record<string, string | undefined>;
  previous: Record<string, string | undefined>;
  since: string;
}) {
  const rows = MEASUREMENT_FIELDS.filter((f) => current[f.key] || previous[f.key]);
  return (
    <View>
      <T variant="caption" style={{ marginBottom: space.xs }}>
        Compared with {fmtDate(since)}
      </T>
      {rows.map((f) => {
        const now = current[f.key] ?? '—';
        const before = previous[f.key] ?? '—';
        const changed = now !== before;
        return (
          <Row key={f.key} style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
            <T variant="small">{f.label}</T>
            <T variant={changed ? 'smallStrong' : 'small'} color={changed ? colors.gold : undefined}>
              {changed ? `${before} → ${now}` : now}
              {changed ? ' (changed)' : ''}
            </T>
          </Row>
        );
      })}
    </View>
  );
}
