import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { api, errorMessage } from '../../../api/client';
import { useApi, useInvalidate } from '../../../api/hooks';
import type { Booking, Product } from '../../../api/types';
import {
  Button,
  Card,
  DateField,
  Header,
  IconButton,
  Input,
  KV,
  Loading,
  MoneyInput,
  Pill,
  Row,
  Screen,
  Section,
  SelectField,
  T,
  ToggleRow,
  toast,
} from '../../../components/ui';
import {
  CustomerPicker,
  MeasurementsEditor,
  ProductPicker,
  cleanMeasurements,
} from '../../../components/admin/Pickers';
import { QuickCustomerSheet } from '../../../components/admin/QuickCustomerSheet';
import { colors, space } from '../../../theme';
import { useNav, useParams } from '../../../navigation/nav';
import { inr, isoDay, num } from '../../../lib/format';

interface ItemDraft {
  key: string;
  product: string;
  productLabel?: string;
  color: string;
  price: string;
  wearerName: string;
  showMeasurements: boolean;
  measurements: Record<string, string>;
  availability?: 'checking' | 'ok' | 'conflict';
  conflictText?: string;
}

const blankItem = (): ItemDraft => ({
  key: Math.random().toString(36).slice(2),
  product: '',
  color: '',
  price: '',
  wearerName: '',
  showMeasurements: false,
  measurements: {},
});

export function BookingFormScreen() {
  const { id, customerId, customerName } = useParams<{
    id: string;
    customerId: string;
    customerName: string;
  }>();
  const editing = Boolean(id);
  const nav = useNav();
  const invalidate = useInvalidate();
  const existing = useApi<{ booking: Booking }>(id ? `/api/admin/bookings/${id}` : null);
  const nextBill = useApi<{ billNumber: string }>(editing ? null : '/api/admin/bill-number');
  const methods = useApi<{ settings: { options: string[] } }>('/api/admin/settings/payment-methods');

  const today = isoDay();
  const [customer, setCustomer] = useState(customerId ?? '');
  const [customerOption, setCustomerOption] = useState(
    customerId ? { value: customerId, label: customerName ?? 'Customer' } : null
  );
  const [billNumber, setBillNumber] = useState('');
  const [bookingDate, setBookingDate] = useState(today);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([blankItem()]);
  const [advance, setAdvance] = useState('');
  const [method, setMethod] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const booked = useApi<{ productIds: string[] }>(
    start && end ? '/api/admin/bookings/booked-products' : null,
    { from: start, to: end, ...(id ? { excludeBooking: id } : {}) }
  );
  const bookedIds = useMemo(() => new Set(booked.data?.productIds ?? []), [booked.data]);
  const [loaded, setLoaded] = useState(!editing);

  // Coming back from "New customer" with the freshly created one.
  useEffect(() => {
    if (customerId) {
      setCustomer(customerId);
      setCustomerOption({
        value: customerId,
        label: customerName ?? 'Customer',
      });
    }
  }, [customerId, customerName]);

  useEffect(() => {
    if (!editing && nextBill.data?.billNumber && !billNumber) setBillNumber(nextBill.data.billNumber);
  }, [nextBill.data, editing, billNumber]);

  useEffect(() => {
    const b = existing.data?.booking;
    if (!b || loaded) return;
    setCustomer(b.customer?._id ?? '');
    setCustomerOption(b.customer ? { value: b.customer._id, label: b.customer.name } : null);
    setBillNumber(b.billNumber);
    setBookingDate(isoDay(new Date(b.bookingDate)));
    setStart(isoDay(new Date(b.rentalStartDate)));
    setEnd(isoDay(new Date(b.rentalEndDate)));
    setItems(
      b.items.map((it) => ({
        key: Math.random().toString(36).slice(2),
        product: it.product?._id ?? '',
        productLabel: it.product?.name,
        color: it.color,
        price: String(it.pricePerDay ?? it.rentalFee),
        wearerName: it.wearerName ?? '',
        showMeasurements: Boolean(it.measurements && Object.keys(it.measurements).length),
        measurements: (it.measurements as Record<string, string>) ?? {},
      }))
    );
    setAdvance(String(b.advancePaid ?? ''));
    setMethod(b.advancePaymentMethod ?? '');
    setAddress(b.deliveryAddress ?? '');
    setNotes(b.notes ?? '');
    setLoaded(true);
  }, [existing.data, loaded]);

  // Live availability for each dress whenever dates or dresses change.
  useEffect(() => {
    if (!start || !end) return;
    items.forEach((item) => {
      if (!item.product) return;
      setItems((list) => list.map((x) => (x.key === item.key ? { ...x, availability: 'checking' } : x)));
      api
        .get<{
          available: boolean;
          conflicts: {
            bookingNumber: string;
            rentalStartDate: string;
            rentalEndDate: string;
          }[];
        }>(`/api/admin/products/${item.product}/availability`, {
          from: start,
          to: end,
          excludeBooking: id,
        })
        .then((r) =>
          setItems((list) =>
            list.map((x) =>
              x.key === item.key
                ? {
                    ...x,
                    availability: r.available ? 'ok' : 'conflict',
                    conflictText: r.conflicts[0] ? `Booked (${r.conflicts[0].bookingNumber})` : 'Booked',
                  }
                : x
            )
          )
        )
        .catch(() =>
          setItems((list) => list.map((x) => (x.key === item.key ? { ...x, availability: undefined } : x)))
        );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, items.map((i) => i.product).join(',')]);

  const update = (key: string, patch: Partial<ItemDraft>) =>
    setItems((list) => list.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const rentTotal = items.reduce((sum, i) => sum + (num(i.price) ?? 0), 0);

  const submit = async () => {
    if (!customer) return toast.error('Choose a customer');
    if (!billNumber.trim()) return toast.error('Bill number is required');
    if (!start || !end) return toast.error('Pick the rental dates');
    if (end < start) return toast.error('Return must be on or after pickup');
    if (items.some((i) => !i.product)) return toast.error('Choose a dress for every line');
    setBusy(true);
    const body = {
      customer,
      billNumber: billNumber.trim(),
      bookingDate,
      rentalStartDate: start,
      rentalEndDate: end,
      items: items.map((i) => ({
        product: i.product,
        color: i.color,
        pricePerDay: num(i.price),
        wearerName: i.wearerName,
        measurements: i.showMeasurements ? cleanMeasurements(i.measurements) : undefined,
      })),
      advancePaid: num(advance) ?? 0,
      advancePaymentMethod: method,
      deliveryAddress: address,
      notes,
    };
    try {
      const result = editing
        ? await api.patch<{ booking: Booking }>(`/api/admin/bookings/${id}`, body)
        : await api.post<{ booking: Booking }>('/api/admin/bookings', body);
      invalidate('/api/admin/bookings', '/api/admin/dashboard', '/api/admin/bill-number');
      toast.success(editing ? 'Booking updated' : 'Booking created', result.booking.bookingNumber);
      if (editing) nav.goBack();
      else nav.replace('BookingDetail', { id: result.booking._id });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!loaded)
    return (
      <Screen header={<Header title="Edit booking" />}>
        <Loading />
      </Screen>
    );

  return (
    <Screen
      header={<Header title={editing ? 'Edit booking' : 'New booking'} />}
      footer={
        <Button
          title={editing ? 'Save changes' : `Create booking · ${inr(rentTotal)}`}
          onPress={submit}
          loading={busy}
        />
      }
    >
      <CustomerPicker
        key={customerOption?.value ?? 'none'}
        value={customer}
        initial={customerOption}
        onChange={(cid) => setCustomer(cid)}
      />
      {!editing ? (
        <Button
          title="New customer"
          icon="Plus"
          variant="ghost"
          size="sm"
          style={{
            alignSelf: 'flex-start',
            marginTop: -space.sm,
            marginBottom: space.md,
          }}
          onPress={() => setQuickOpen(true)}
        />
      ) : null}
      <QuickCustomerSheet
        visible={quickOpen}
        onClose={() => setQuickOpen(false)}
        onCreated={(c) => {
          setCustomer(c._id);
          setCustomerOption({ value: c._id, label: c.name });
          if (c.address && !address) setAddress(c.address);
        }}
      />
      <Row gap={space.md}>
        <Input
          label="Bill no."
          value={billNumber}
          onChangeText={setBillNumber}
          required
          style={{ flex: 1 }}
        />
        <DateField label="Booked on" value={bookingDate} onChange={setBookingDate} style={{ flex: 1 }} />
      </Row>
      <Row gap={space.md}>
        <DateField
          label="Pickup"
          value={start}
          onChange={(v) => {
            setStart(v);
            if (!end || end < v) setEnd(v);
          }}
          required
          style={{ flex: 1 }}
        />
        <DateField label="Return" value={end} onChange={setEnd} required style={{ flex: 1 }} />
      </Row>

      <Section title="Dresses" style={{ marginTop: space.md }}>
        {items.map((item, index) => (
          <Card key={item.key} style={{ marginBottom: space.md }}>
            <Row
              style={{
                justifyContent: 'space-between',
                marginBottom: space.sm,
              }}
            >
              <T variant="caption">Dress {index + 1}</T>
              <Row>
                {item.availability === 'checking' ? <T variant="small">Checking…</T> : null}
                {item.availability === 'ok' ? <Pill label="Available" tone="success" small /> : null}
                {item.availability === 'conflict' ? (
                  <Pill label={item.conflictText ?? 'Booked'} tone="danger" small />
                ) : null}
                {items.length > 1 ? (
                  <IconButton
                    icon="X"
                    size={30}
                    onPress={() => setItems((l) => l.filter((x) => x.key !== item.key))}
                    accessibilityLabel="Remove dress"
                  />
                ) : null}
              </Row>
            </Row>
            <ProductPicker
              bookable
              bookedIds={bookedIds}
              value={item.product}
              initial={item.product ? { value: item.product, label: item.productLabel ?? 'Dress' } : null}
              onChange={(pid, product: Product | null, option) =>
                update(item.key, {
                  product: pid,
                  productLabel: option.label,
                  color: product?.color ?? item.color,
                  price: product ? String(product.rentalPricePerDay) : item.price,
                })
              }
            />
            <Row gap={space.md}>
              <MoneyInput
                label="Rent"
                value={item.price}
                onChangeText={(v) => update(item.key, { price: v })}
                style={{ flex: 1 }}
              />
              <Input
                label="Colour"
                value={item.color}
                onChangeText={(v) => update(item.key, { color: v })}
                style={{ flex: 1 }}
              />
            </Row>
            <Input
              label="Wearer"
              hint="Optional"
              value={item.wearerName}
              onChangeText={(v) => update(item.key, { wearerName: v })}
            />
            <ToggleRow
              label="Measurements"
              value={item.showMeasurements}
              onChange={(v) => update(item.key, { showMeasurements: v })}
            />
            {item.showMeasurements ? (
              <MeasurementsEditor
                value={item.measurements}
                onChange={(v) => update(item.key, { measurements: v })}
              />
            ) : null}
          </Card>
        ))}
        <Button
          title="Add another dress"
          icon="Plus"
          variant="outline"
          onPress={() => setItems((l) => [...l, blankItem()])}
        />
      </Section>

      <Section title="Payment">
        <Row gap={space.md}>
          <MoneyInput label="Advance" value={advance} onChangeText={setAdvance} style={{ flex: 1 }} />
          <SelectField
            label="Paid via"
            value={method}
            onChange={setMethod}
            options={(methods.data?.settings?.options ?? ['Cash', 'Online']).map((o) => ({
              value: o,
              label: o,
            }))}
            style={{ flex: 1 }}
          />
        </Row>
        <Card>
          <KV label="Rent total" value={inr(rentTotal)} />
          <KV label="Advance" value={inr(num(advance) ?? 0)} />
          <KV label="Balance at pickup" value={inr(Math.max(0, rentTotal - (num(advance) ?? 0)))} strong />
          <T variant="small" color={colors.textFaint} style={{ marginTop: space.xs }}>
            Any advance marks the booking Confirmed. Security deposit is taken at pickup.
          </T>
        </Card>
      </Section>

      <Section title="Details">
        <Input label="Delivery address" value={address} onChangeText={setAddress} multiline />
        <Input label="Notes" value={notes} onChangeText={setNotes} multiline />
      </Section>
      <View style={{ height: space.xl }} />
    </Screen>
  );
}
