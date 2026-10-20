import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { api, errorMessage } from '../../../api/client';
import { useAction, useApi, useInvalidate } from '../../../api/hooks';
import type { Booking, ReturnCondition } from '../../../api/types';
import {
  Button,
  Card,
  Divider,
  ErrorState,
  Header,
  Icon,
  IconButton,
  ImageViewer,
  Img,
  Input,
  KV,
  ListRow,
  Loading,
  MoneyInput,
  Pill,
  ProgressSteps,
  Row,
  Screen,
  Section,
  SelectField,
  Sheet,
  T,
  Tap,
  ToggleRow,
  confirm,
  toast,
} from '../../../components/ui';
import { MeasurementsView } from '../../../components/admin/Pickers';
import { colors, space } from '../../../theme';
import { useNav, useParams } from '../../../navigation/nav';
import { fmtDate, fmtDateTime, inr, num } from '../../../lib/format';
import { BOOKING_STATUS, BOOKING_TRANSITIONS } from '../../../lib/labels';
import { useRole } from '../../../auth/AuthContext';
import { isManager } from '../../../lib/roles';
import { call, shareLink, whatsapp } from '../../../lib/share';
import { AuditHistory } from '../../../components/admin/AuditHistory';
import {
  bookingDepositHeld,
  bookingDepositUsed,
  bookingPaidBreakdown,
  bookingRemainingDue,
  bookingRent,
  depositStateText,
} from '../../../lib/bookingMoney';

type Flow = 'confirm' | 'pickup' | 'return' | null;

/** Same split as the web booking page — see lib/bookingMoney (port of lib/admin/booking-status). */
function money(b: Booking) {
  const { advance, duePaid, securityHeld } = bookingPaidBreakdown(b);
  const paid = b.advancePaid ?? 0;
  return {
    rent: bookingRent(b),
    paid,
    advance,
    pickup: paid - advance,
    duePaid,
    securityHeld,
    remaining: bookingRemainingDue(b),
    depositUsed: bookingDepositUsed(b),
    depositHeld: bookingDepositHeld(b),
    depositText: depositStateText(b),
  };
}

export function BookingDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const nav = useNav();
  const role = useRole();
  const invalidate = useInvalidate();
  const query = useApi<{
    booking: Booking;
    review?: {
      customerName: string;
      rating: number;
      comment?: string;
      images: string[];
      createdAt: string;
    } | null;
  }>(id ? `/api/admin/bookings/${id}` : null);
  const b = query.data?.booking;
  const customerReview = query.data?.review ?? null;
  const [flow, setFlow] = useState<Flow>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [viewer, setViewer] = useState<{ images: string[]; index: number } | null>(null);

  const refresh = () =>
    invalidate(
      '/api/admin/bookings',
      '/api/admin/invoices',
      '/api/admin/dashboard',
      '/api/admin/products',
      '/api/admin/service-orders'
    );

  const makeInvoice = useAction(
    async () => api.post<{ invoice: { _id: string } }>('/api/admin/invoices/from-booking', { bookingId: id }),
    {
      success: 'Invoice ready',
      onSuccess: (data) => {
        refresh();
        nav.navigate('InvoiceDetail', { id: data.invoice._id });
      },
    }
  );
  const remind = useAction(() => api.post(`/api/admin/bookings/${id}/remind`), {
    success: 'WhatsApp reminder sent',
  });
  const review = useAction(
    () =>
      api.post<{ reviewUrl: string; whatsappUrl: string; message: string }>(
        `/api/admin/bookings/${id}/review-request`
      ),
    { onSuccess: (data) => shareLink(data.message, data.reviewUrl) }
  );
  const refund = useAction(() => api.post(`/api/admin/bookings/${id}/refund-deposit`), {
    success: 'Deposit marked refunded',
    onSuccess: refresh,
  });
  const cancel = useAction(() => api.patch(`/api/admin/bookings/${id}`, { status: 'cancelled' }), {
    success: 'Booking cancelled',
    onSuccess: refresh,
  });
  const remove = useAction(() => api.delete(`/api/admin/bookings/${id}`), {
    success: 'Moved to Trash',
    onSuccess: () => {
      refresh();
      nav.goBack();
    },
  });

  if (query.isLoading)
    return (
      <Screen header={<Header title="Booking" />}>
        <Loading />
      </Screen>
    );
  if (!b)
    return (
      <Screen header={<Header title="Booking" />}>
        <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />
      </Screen>
    );

  const status = BOOKING_STATUS[b.status];
  const m = money(b);
  const next = BOOKING_TRANSITIONS[b.status];
  const phone = b.customer?.phone;

  const primary = next.includes('confirmed') ? (
    <Button title="Confirm booking" icon="Check" onPress={() => setFlow('confirm')} />
  ) : next.includes('in_use') ? (
    <Button title="Hand over · Pickup" icon="Package" onPress={() => setFlow('pickup')} />
  ) : next.includes('returned') ? (
    <Button title="Receive return" icon="RotateCcw" onPress={() => setFlow('return')} />
  ) : (
    <Button
      title="Open invoice"
      icon="FileText"
      onPress={() => makeInvoice.mutate()}
      loading={makeInvoice.isPending}
    />
  );

  return (
    <Screen
      header={
        <Header
          title={`#${b.billNumber || b.bookingNumber}`}
          subtitle={b.bookingNumber}
          right={
            isManager(role) && b.status !== 'returned' && b.status !== 'cancelled' ? (
              <IconButton
                icon="Pencil"
                onPress={() => nav.navigate('BookingForm', { id: b._id })}
                accessibilityLabel="Edit booking"
              />
            ) : null
          }
        />
      }
      refreshing={query.isRefetching}
      onRefresh={() => query.refetch()}
      footer={primary}
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <Pill label={status.label} tone={status.tone} />
        <T variant="small">Booked {fmtDate(b.bookingDate)}</T>
      </Row>
      <View style={{ marginTop: space.lg }}>
        <ProgressSteps
          steps={[
            { key: 'inquiry', label: 'Booked' },
            { key: 'confirmed', label: 'Confirmed' },
            { key: 'in_use', label: 'Picked up' },
            { key: 'returned', label: 'Returned' },
          ]}
          current={b.status === 'pending_payment' ? 'inquiry' : b.status}
          cancelled={b.status === 'cancelled'}
        />
      </View>

      {/* Customer */}
      <Card style={{ marginTop: space.lg }}>
        <T variant="caption">Customer</T>
        <Row style={{ justifyContent: 'space-between', marginTop: space.xs }}>
          <View style={{ flex: 1 }}>
            <T variant="h3">{b.customer?.name ?? '—'}</T>
            <T variant="small">{[phone, b.customer?.email].filter(Boolean).join(' · ')}</T>
          </View>
          {phone ? (
            <Row>
              <IconButton icon="Phone" onPress={() => call(phone)} accessibilityLabel="Call" />
              <IconButton
                icon="MessageCircle"
                onPress={() => whatsapp(phone)}
                accessibilityLabel="WhatsApp"
              />
            </Row>
          ) : null}
        </Row>
        {b.customer?._id ? (
          <Button
            title="Customer profile"
            variant="ghost"
            size="sm"
            onPress={() => nav.navigate('CustomerDetail', { id: b.customer!._id })}
            style={{ alignSelf: 'flex-start', marginTop: space.sm }}
          />
        ) : null}
      </Card>

      {/* Dates */}
      <Card style={{ marginTop: space.md }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <T variant="caption">Pickup</T>
            <T variant="h3">{fmtDate(b.rentalStartDate)}</T>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <T variant="caption">Return</T>
            <T variant="h3">{fmtDate(b.rentalEndDate)}</T>
          </View>
        </Row>
        {b.deliveryAddress ? <KV label="Delivery" value={b.deliveryAddress} /> : null}
      </Card>

      <Section title={`Dresses · ${b.items.length}`}>
        {b.items.map((item, i) => (
          <View key={i}>
            <ListRow
              leading={
                <Tap
                  disabled={!item.product?.images?.length}
                  onPress={() => setViewer({ images: item.product?.images ?? [], index: 0 })}
                  accessibilityLabel="View photos"
                >
                  <Img src={item.product?.images?.[0]} style={{ width: 48, height: 60 }} rounded={8} />
                </Tap>
              }
              title={item.product?.name ?? 'Dress'}
              subtitle={[item.product?.sku, item.color, item.size].filter(Boolean).join(' · ')}
              meta={item.wearerName ? `Wearer: ${item.wearerName}` : undefined}
              right={<T variant="bodyStrong">{inr(item.rentalFee)}</T>}
              onPress={
                item.product?._id ? () => nav.navigate('ProductDetail', { id: item.product!._id }) : undefined
              }
              chevron={false}
            />
            {b.status === 'returned' && item.product ? (
              <Button
                title="Send to dry clean"
                icon="Sparkles"
                variant="outline"
                size="sm"
                style={{ alignSelf: 'flex-start', marginLeft: 64, marginBottom: space.sm }}
                onPress={() =>
                  nav.navigate('ServiceForm', {
                    productId: item.product!._id,
                    productName: item.product!.name,
                    bookingId: b._id,
                    bookingRef: b.billNumber ?? '',
                    description: `Post-return dry clean for booking ${b.bookingNumber}`,
                  })
                }
              />
            ) : null}
          </View>
        ))}
        <ImageViewer
          images={viewer?.images ?? []}
          index={viewer?.index ?? null}
          onClose={() => setViewer(null)}
        />
      </Section>

      <Section title="Money">
        <Card>
          <KV label="Rent" value={inr(m.rent)} />
          <KV label="Security deposit" value={inr(b.securityDeposit)} />
          <Divider />
          <KV label="Advance paid" value={inr(m.advance)} />
          {m.duePaid ? <KV label="Rent paid at pickup" value={inr(m.duePaid)} /> : null}
          {m.depositHeld ? <KV label="Security held" value={inr(m.depositHeld)} tone="info" /> : null}
          {b.status === 'returned' ? (
            <>
              <KV label="Damage charges" value={inr(b.damageCharges ?? 0)} />
              {m.depositUsed ? <KV label="Deposit used for rent/damage" value={inr(m.depositUsed)} /> : null}
            </>
          ) : null}
          {m.depositText ? (
            <KV
              label="Deposit"
              value={m.depositText}
              tone={b.depositRefunded ? 'success' : b.status === 'returned' ? 'warning' : undefined}
            />
          ) : null}
          <Divider />
          <KV
            label="Remaining due"
            value={inr(m.remaining)}
            strong
            tone={m.remaining > 0 ? 'warning' : 'success'}
          />
          {b.advancePaymentMethod ? <KV label="Advance via" value={b.advancePaymentMethod} /> : null}
        </Card>
      </Section>

      {b.measurements && Object.keys(b.measurements).length ? (
        <Section title="Measurements">
          <Card>
            <MeasurementsView value={b.measurements as Record<string, string>} />
          </Card>
        </Section>
      ) : null}

      {b.status === 'returned' ? (
        <Section title="Return">
          <Card>
            <KV label="Returned" value={fmtDateTime(b.returnedAt)} />
            <KV label="Condition" value={(b.returnCondition ?? 'good').replace('_', ' ')} />
            {b.dryCleaningRequired ? <KV label="Dry cleaning" value="Sent" /> : null}
            {b.stitchingRequired ? <KV label="Stitching" value="Sent" /> : null}
            {b.returnNotes ? (
              <T variant="small" style={{ marginTop: space.sm }}>
                {b.returnNotes}
              </T>
            ) : null}
          </Card>
        </Section>
      ) : null}

      {b.notes ? (
        <Section title="Notes">
          <Card>
            <T variant="body">{b.notes}</T>
          </Card>
        </Section>
      ) : null}

      {customerReview || b.reviewRequestedAt ? (
        <Section title="Customer review">
          <Card>
            {customerReview ? (
              <>
                <Row gap={2}>
                  {[1, 2, 3, 4, 5].map((v) => (
                    <Icon
                      key={v}
                      name="Star"
                      size={16}
                      color={v <= customerReview.rating ? colors.gold : colors.textFaint}
                      fill={v <= customerReview.rating ? colors.gold : 'none'}
                    />
                  ))}
                </Row>
                <T variant="small" style={{ marginTop: 4 }}>
                  by {customerReview.customerName} · {fmtDate(customerReview.createdAt)}
                </T>
                {customerReview.comment ? (
                  <T variant="body" style={{ marginTop: space.sm, fontStyle: 'italic' }}>
                    “{customerReview.comment}”
                  </T>
                ) : null}
                {customerReview.images.length ? (
                  <Row gap={space.sm} style={{ marginTop: space.md, flexWrap: 'wrap' }}>
                    {customerReview.images.map((src, i) => (
                      <Tap
                        key={src}
                        onPress={() => setViewer({ images: customerReview.images, index: i })}
                        accessibilityLabel={`Review photo ${i + 1}`}
                      >
                        <Img src={src} style={{ width: 72, height: 90 }} rounded={8} />
                      </Tap>
                    ))}
                  </Row>
                ) : null}
              </>
            ) : (
              <T variant="small">
                Review requested {fmtDate(b.reviewRequestedAt!)} — waiting for the customer.
              </T>
            )}
          </Card>
        </Section>
      ) : null}

      <Sheet
        visible={cancelOpen}
        onClose={() => {
          setCancelOpen(false);
          setAcknowledged(false);
        }}
        title="Cancel this booking?"
        footer={
          <View style={{ gap: space.sm }}>
            <Button
              title="Cancel booking — no refund"
              variant="danger"
              disabled={!acknowledged}
              loading={cancel.isPending}
              onPress={() => {
                cancel.mutate();
                setCancelOpen(false);
                setAcknowledged(false);
              }}
            />
            <Button title="Keep booking" variant="ghost" onPress={() => setCancelOpen(false)} />
          </View>
        }
      >
        <T variant="body">
          {b.customer?.name ? `${b.customer.name}'s booking` : 'This booking'} will be cancelled and the dress
          released for other bookings. This cannot be undone.
        </T>
        <View
          style={{
            marginTop: space.md,
            padding: space.md,
            borderRadius: 12,
            backgroundColor: colors.dangerBg,
          }}
        >
          <T variant="bodyStrong" color={colors.danger}>
            {(b.advancePaid ?? 0) > 0
              ? `Advance of ${inr(b.advancePaid)} will NOT be refunded.`
              : 'No advance has been recorded on this booking.'}
          </T>
          <T variant="small" style={{ marginTop: space.xs }}>
            As per booking terms, a booked dress cannot be cancelled — if cancelled, the advance deposit is
            not returned.
          </T>
          <T variant="small" style={{ marginTop: space.xs }}>
            ड्रेस बुक हो जाने के बाद उसे कैंसिल नहीं किया जाएगा यदि कैंसिल किया जाता है तो एडवांस जमा रुपये
            वापस नहीं होगें।
          </T>
        </View>
        <ToggleRow
          label="Customer has been told"
          description={`I confirm the customer has been told the advance${
            (b.advancePaid ?? 0) > 0 ? ` of ${inr(b.advancePaid)}` : ''
          } will not be refunded.`}
          value={acknowledged}
          onChange={setAcknowledged}
        />
      </Sheet>

      <AuditHistory entityType="Booking" entityId={b._id} />

      <Section title="Actions">
        <ListRow
          icon="FileText"
          title="Invoice"
          subtitle="Generate or update the bill for this booking"
          onPress={() => makeInvoice.mutate()}
        />
        {phone && b.status !== 'cancelled' && b.status !== 'returned' ? (
          <ListRow icon="Send" title="Send WhatsApp reminder" onPress={() => remind.mutate()} />
        ) : null}
        {b.status === 'returned' ? (
          <ListRow
            icon="Star"
            title="Request a review"
            subtitle="Share the review link with the customer"
            onPress={() => review.mutate()}
          />
        ) : null}
        {b.status === 'returned' && (b.depositRefundAmount ?? 0) > 0 && !b.depositRefunded ? (
          <ListRow
            icon="Banknote"
            title={`Refund deposit · ${inr(b.depositRefundAmount)}`}
            onPress={async () => {
              if (
                await confirm({
                  title: 'Mark deposit refunded?',
                  message: `${inr(b.depositRefundAmount)} handed back to the customer.`,
                  confirmText: 'Mark refunded',
                })
              )
                refund.mutate();
            }}
          />
        ) : null}
        {b.status === 'returned' && isManager(role) ? (
          <ListRow
            icon="Undo2"
            title="Undo return"
            subtitle="Move back to Picked Up"
            onPress={() => nav.navigate('UndoReturn', { id: b._id })}
          />
        ) : null}
        {next.includes('cancelled') ? (
          <ListRow icon="X" danger title="Cancel booking" onPress={() => setCancelOpen(true)} />
        ) : null}
        {isManager(role) ? (
          <ListRow
            icon="Trash"
            danger
            title="Move to Trash"
            onPress={async () => {
              if (
                await confirm({
                  title: 'Move booking to Trash?',
                  message: 'You can restore it from Trash later.',
                  confirmText: 'Move to Trash',
                  destructive: true,
                })
              )
                remove.mutate();
            }}
          />
        ) : null}
      </Section>

      <ConfirmFlow booking={b} visible={flow === 'confirm'} onClose={() => setFlow(null)} onDone={refresh} />
      <PickupFlow booking={b} visible={flow === 'pickup'} onClose={() => setFlow(null)} onDone={refresh} />
      <ReturnFlow booking={b} visible={flow === 'return'} onClose={() => setFlow(null)} onDone={refresh} />
    </Screen>
  );
}

interface FlowProps {
  booking: Booking;
  visible: boolean;
  onClose: () => void;
  onDone: () => void;
}

/** After any lifecycle change the web app (re)generates the booking invoice — mirror that. */
/** Create or resync the booking's invoice (web: invoices/from-booking). Returns its id. */
async function syncInvoice(bookingId: string): Promise<string | null> {
  try {
    const r = await api.post<{ invoice: { _id: string } }>('/api/admin/invoices/from-booking', { bookingId });
    return r.invoice?._id ?? null;
  } catch (e) {
    toast.error('Status saved, but the invoice did not update', errorMessage(e));
    return null;
  }
}

function ConfirmFlow({ booking, visible, onClose, onDone }: FlowProps) {
  const [rent, setRent] = useState(String(Math.max(0, booking.totalAmount - booking.securityDeposit)));
  const [advance, setAdvance] = useState(String(booking.advancePaid ?? 0));
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api.patch(`/api/admin/bookings/${booking._id}`, {
        status: 'confirmed',
        rentAmount: num(rent) ?? 0,
        advancePaid: num(advance) ?? 0,
      });
      await syncInvoice(booking._id);
      toast.success('Booking confirmed');
      onDone();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Confirm booking"
      subtitle="Lock in the price and advance received."
      footer={<Button title="Confirm" onPress={submit} loading={busy} />}
    >
      <MoneyInput label="Rent amount" value={rent} onChangeText={setRent} required />
      <MoneyInput label="Advance received" value={advance} onChangeText={setAdvance} />
      <KV
        label="Remaining at pickup"
        value={inr(Math.max(0, (num(rent) ?? 0) - (num(advance) ?? 0)))}
        strong
      />
    </Sheet>
  );
}

function PickupFlow({ booking, visible, onClose, onDone }: FlowProps) {
  const rentTotal = Math.max(0, booking.totalAmount - booking.securityDeposit);
  const [deposit, setDeposit] = useState(String(booking.securityDeposit || ''));
  const depositValue = num(deposit) ?? 0;
  const due = Math.max(0, rentTotal + depositValue - (booking.advancePaid ?? 0));
  const [payment, setPayment] = useState(String(due));
  const [busy, setBusy] = useState(false);
  const rentDue = Math.max(0, rentTotal - (booking.advancePaid ?? 0));

  const submit = async () => {
    setBusy(true);
    try {
      await api.patch(`/api/admin/bookings/${booking._id}`, {
        status: 'in_use',
        pickupPaymentAmount: num(payment) ?? 0,
        securityDeposit: depositValue,
      });
      await syncInvoice(booking._id);
      toast.success('Dress handed over');
      onDone();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Pickup"
      subtitle="Collect the balance and security deposit."
      footer={<Button title="Complete pickup" onPress={submit} loading={busy} />}
    >
      <KV label="Rent still due" value={inr(rentDue)} />
      <MoneyInput
        label="Security deposit"
        value={deposit}
        onChangeText={(v) => {
          setDeposit(v);
        }}
        hint="Refundable at return"
      />
      <KV label="Total to collect now" value={inr(due)} strong />
      <MoneyInput
        label="Amount collected"
        value={payment}
        onChangeText={setPayment}
        required
        style={{ marginTop: space.md }}
      />
    </Sheet>
  );
}

function ReturnFlow({ booking, visible, onClose, onDone }: FlowProps) {
  const nav = useNav();
  const [condition, setCondition] = useState<ReturnCondition>('good');
  const [notes, setNotes] = useState('');
  const [dry, setDry] = useState(false);
  const [stitch, setStitch] = useState(false);
  const [damage, setDamage] = useState('');
  const [deposit, setDeposit] = useState(String(booking.securityDeposit || 0));
  const pendingDefault = Math.max(
    0,
    booking.totalAmount - booking.securityDeposit - (booking.advancePaid ?? 0)
  );
  const [pending, setPending] = useState(String(pendingDefault));
  const [refunded, setRefunded] = useState(true);
  const [busy, setBusy] = useState(false);

  const calc = useMemo(() => {
    const owed = (num(damage) ?? 0) + (num(pending) ?? 0);
    const net = owed - (num(deposit) ?? 0);
    return { refund: net < 0 ? -net : 0, collect: net > 0 ? net : 0 };
  }, [damage, pending, deposit]);

  const submit = async () => {
    setBusy(true);
    try {
      await api.patch(`/api/admin/bookings/${booking._id}`, {
        status: 'returned',
        returnCondition: condition,
        returnNotes: notes,
        dryCleaningRequired: dry,
        stitchingRequired: stitch,
        securityDeposit: num(deposit) ?? 0,
        damageCharges: num(damage) ?? 0,
        pendingRentAmount: num(pending) ?? 0,
        depositRefunded: refunded,
      });
      const invoiceId = await syncInvoice(booking._id);
      toast.success('Booking marked as returned');
      onDone();
      onClose();
      // Same closing step as the web's "Return confirmed": show the settlement and offer the bill.
      const settle = calc.collect > 0;
      if (
        invoiceId &&
        (await confirm({
          title: 'Return confirmed',
          message: `${
            settle
              ? `Pending amount ${inr(calc.collect)}`
              : refunded
              ? `Refunded ${inr(calc.refund)}`
              : `Refund due ${inr(calc.refund)}`
          }\n\nThe invoice has been updated with this settlement and added to the Sale menu.`,
          confirmText: 'Open invoice',
          cancelText: 'Done',
        }))
      )
        nav.navigate('InvoiceDetail', { id: invoiceId });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Receive return"
      footer={<Button title="Complete return" onPress={submit} loading={busy} />}
    >
      <SelectField
        label="Condition"
        value={condition}
        onChange={(v) => setCondition(v as ReturnCondition)}
        options={[
          { value: 'good', label: 'Good' },
          { value: 'minor_damage', label: 'Minor damage' },
          { value: 'major_damage', label: 'Major damage' },
          { value: 'missing_items', label: 'Missing items' },
        ]}
      />
      <MoneyInput label="Damage charges" value={damage} onChangeText={setDamage} />
      <MoneyInput label="Unpaid rent" value={pending} onChangeText={setPending} />
      <MoneyInput label="Security deposit held" value={deposit} onChangeText={setDeposit} />
      <Card style={{ marginBottom: space.lg }}>
        {calc.refund > 0 ? (
          <KV label="Refund to customer" value={inr(calc.refund)} strong tone="success" />
        ) : null}
        {calc.collect > 0 ? (
          <KV label="Collect from customer" value={inr(calc.collect)} strong tone="warning" />
        ) : null}
        {calc.refund === 0 && calc.collect === 0 ? <KV label="Settlement" value="All square" strong /> : null}
      </Card>
      {calc.refund > 0 ? (
        <ToggleRow label="Deposit handed back now" value={refunded} onChange={setRefunded} />
      ) : null}
      <ToggleRow
        label="Send for dry cleaning"
        description="Creates a dry-clean service order"
        value={dry}
        onChange={setDry}
      />
      <ToggleRow
        label="Needs stitching / repair"
        description="Creates a tailor service order"
        value={stitch}
        onChange={setStitch}
      />
      <Input label="Notes" value={notes} onChangeText={setNotes} multiline />
    </Sheet>
  );
}

export function UndoReturnScreen() {
  const { id } = useParams<{ id: string }>();
  const nav = useNav();
  const invalidate = useInvalidate();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Screen
      header={<Header title="Undo return" />}
      footer={
        <Button
          title="Undo return"
          variant="danger"
          loading={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await api.post(`/api/admin/bookings/${id}/undo-return`, {
                reason,
              });
              await api
                .post('/api/admin/invoices/from-booking', {
                  bookingId: id,
                  undoReturn: true,
                })
                .catch(() => {});
              invalidate('/api/admin/bookings', '/api/admin/invoices', '/api/admin/service-orders');
              toast.success('Return undone');
              nav.goBack();
            } catch (e) {
              toast.error(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        />
      }
    >
      <T variant="body" muted>
        The booking goes back to “Picked Up”. Any dry-clean / tailor orders created automatically at return
        are cancelled.
      </T>
      <Input
        label="Reason"
        value={reason}
        onChangeText={setReason}
        multiline
        style={{ marginTop: space.lg }}
      />
    </Screen>
  );
}
