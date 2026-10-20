import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api, errorMessage } from '../../../api/client';
import { useAction, useApi, useInvalidate } from '../../../api/hooks';
import type { Booking, Invoice } from '../../../api/types';
import {
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
  ListRow,
  ListScreen,
  Loading,
  MoneyInput,
  Pill,
  Row,
  Screen,
  Section,
  Segmented,
  SelectField,
  T,
  Sheet,
  Tap,
  confirm,
  toast,
} from '../../../components/ui';
import { CustomerPicker } from '../../../components/admin/Pickers';
import { PaymentSheet } from '../../../components/admin/PaymentSheet';
import { colors, space } from '../../../theme';
import { useNav, useParams } from '../../../navigation/nav';
import { fmtDate, fmtDateTime, inr, isoDay, num, titleCase } from '../../../lib/format';
import { INVOICE_STATUS, invoiceStageLabel } from '../../../lib/labels';
import { useRole } from '../../../auth/AuthContext';
import { isManager } from '../../../lib/roles';
import { openUrl, printPdf, pdfUrl, shareLink, whatsapp } from '../../../lib/share';
import { BULK, EXPORTS, SORTS, TRASH } from '../listConfig';
import { AuditHistory } from '../../../components/admin/AuditHistory';

const STATUS_CHIPS = [
  { value: 'all', label: 'All' },
  { value: 'partially_paid', label: 'Part paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'draft', label: 'Draft' },
  { value: 'cancelled', label: 'Cancelled' },
];

const TYPES = [
  { value: 'all', label: 'All types' },
  { value: 'booking', label: 'Rentals' },
  { value: 'sale', label: 'Sales' },
  { value: 'customisation', label: 'Stitching' },
  { value: 'manual', label: 'Manual' },
];

function sourceLabel(inv: Invoice): string {
  if (inv.booking) return `Booking ${inv.booking.bookingNumber}`;
  if (inv.sale) return `Sale #${inv.sale.billNumber}`;
  if (inv.customisationOrder) return `Stitching #${inv.customisationOrder.billNumber}`;
  return 'Manual invoice';
}

export function InvoicesScreen() {
  const nav = useNav();
  const params = useParams<{ status: string }>();
  const [type, setType] = useState('all');
  return (
    <ListScreen<Invoice>
      key={type}
      title="Invoices"
      large
      path="/api/admin/invoices"
      listKey="invoices"
      bulk={BULK.invoices}
      trash={TRASH.invoices}
      filters={{ sorts: SORTS.invoices }}
      exporter={EXPORTS.invoices}
      query={{ type }}
      chips={STATUS_CHIPS}
      defaultChip={params.status ?? 'all'}
      search="Invoice, bill no., customer"
      onCreate={() => nav.navigate('InvoiceForm')}
      createLabel="Invoice"
      headerRight={
        <IconButton icon="ChartBar" onPress={() => nav.navigate('Reports')} accessibilityLabel="Reports" />
      }
      top={() => (
        <Chips
          options={TYPES}
          value={type}
          onChange={setType}
          style={{ marginHorizontal: -space.lg, marginBottom: space.md }}
        />
      )}
      renderItem={(inv) => {
        const st = INVOICE_STATUS[inv.status];
        return (
          <ListRow
            title={inv.billTo?.name || inv.customer?.name || 'Customer'}
            subtitle={`${inv.invoiceNumber} · ${sourceLabel(inv)}`}
            meta={fmtDate(inv.issuedAt ?? inv.createdAt)}
            right={
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <T variant="bodyStrong">{inr(inv.total)}</T>
                <Pill label={st?.label ?? inv.status} tone={st?.tone} small />
              </View>
            }
            chevron={false}
            onPress={() => nav.navigate('InvoiceDetail', { id: inv._id })}
          />
        );
      }}
      empty={{ icon: 'FileText', title: 'No invoices' }}
    />
  );
}

export function InvoiceDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const nav = useNav();
  const role = useRole();
  const invalidate = useInvalidate();
  const q = useApi<{ invoice: Invoice }>(id ? `/api/admin/invoices/${id}` : null);
  const [paying, setPaying] = useState(false);
  const [pdfMenu, setPdfMenu] = useState(false);
  const refresh = () =>
    invalidate(
      '/api/admin/invoices',
      '/api/admin/dashboard',
      '/api/admin/bookings',
      '/api/admin/sales',
      '/api/admin/customisation-orders'
    );

  const pay = useAction(
    (input: { amount: number; method: string; reference?: string; note?: string }) =>
      api.post(`/api/admin/invoices/${id}/payments`, input),
    {
      success: 'Payment recorded',
      onSuccess: () => {
        setPaying(false);
        refresh();
      },
    }
  );
  const send = useAction(() => api.post(`/api/admin/invoices/${id}/send`), {
    success: 'Invoice sent on WhatsApp',
    onSuccess: refresh,
  });
  const remind = useAction(() => api.post(`/api/admin/invoices/${id}/remind`), {
    success: 'Reminder sent',
  });
  const cancel = useAction(() => api.post(`/api/admin/invoices/${id}/cancel`), {
    success: 'Invoice cancelled',
    onSuccess: refresh,
  });
  const refund = useAction(() => api.post(`/api/admin/invoices/${id}/refund-deposit`), {
    success: 'Deposit refunded',
    onSuccess: refresh,
  });
  const remove = useAction(() => api.delete(`/api/admin/invoices/${id}`), {
    success: 'Moved to Trash',
    onSuccess: () => {
      refresh();
      nav.goBack();
    },
  });

  if (q.isLoading)
    return (
      <Screen header={<Header title="Invoice" />}>
        <Loading />
      </Screen>
    );
  const inv = q.data?.invoice;
  if (!inv)
    return (
      <Screen header={<Header title="Invoice" />}>
        <ErrorState message={errorMessage(q.error)} />
      </Screen>
    );
  const st = INVOICE_STATUS[inv.status];
  const phone = inv.billTo?.phone || inv.customer?.phone;
  const url = pdfUrl('invoices', inv._id);
  const payable = inv.amountDue > 0 && inv.status !== 'cancelled';

  return (
    <Screen
      header={
        <Header
          title={inv.invoiceNumber}
          subtitle={sourceLabel(inv)}
          right={
            <>
              <IconButton
                icon="Share2"
                onPress={() => shareLink(`Invoice ${inv.invoiceNumber} from Color Times`, url)}
                accessibilityLabel="Share PDF"
              />
              <IconButton icon="FileText" onPress={() => setPdfMenu(true)} accessibilityLabel="Open PDF" />
              <IconButton
                icon="Printer"
                onPress={() => printPdf(url, `invoice-${inv.invoiceNumber}`)}
                accessibilityLabel="Print"
              />
            </>
          }
        />
      }
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
      footer={
        payable ? (
          <Button
            title={`Record payment · ${inr(inv.amountDue)} due`}
            icon="Wallet"
            onPress={() => setPaying(true)}
          />
        ) : undefined
      }
    >
      <Sheet visible={pdfMenu} onClose={() => setPdfMenu(false)} title="Invoice PDF">
        <Button
          title="English PDF"
          icon="FileText"
          variant="outline"
          style={{ marginBottom: space.sm }}
          onPress={() => {
            setPdfMenu(false);
            openUrl(url);
          }}
        />
        <Button
          title="हिंदी PDF (Hindi)"
          icon="Languages"
          variant="outline"
          style={{ marginBottom: space.sm }}
          onPress={() => {
            setPdfMenu(false);
            openUrl(api.url(`/bill/${inv._id}/hi`));
          }}
        />
        <T variant="small">
          The Hindi bill is prepared in your browser, where you can open, download, share or print it.
        </T>
      </Sheet>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={space.xs}>
            <Pill label={st.label} tone={st.tone} />
            {invoiceStageLabel(inv.bookingStage) ? (
              <Pill label={invoiceStageLabel(inv.bookingStage)!} tone="muted" />
            ) : null}
          </Row>
          <T variant="small">Due {fmtDate(inv.dueDate)}</T>
        </Row>
        <T variant="hero" style={{ marginTop: space.md }}>
          {inr(inv.total)}
        </T>
        <Row gap={space.lg} style={{ marginTop: space.xs }}>
          <T variant="small" color={colors.success}>
            Paid {inr(inv.amountPaid)}
          </T>
          <T variant="small" color={inv.amountDue > 0 ? colors.warning : colors.textMuted}>
            Due {inr(inv.amountDue)}
          </T>
        </Row>
      </Card>

      <Section title="Billed to">
        <Card>
          <T variant="h3">{inv.billTo?.name || inv.customer?.name}</T>
          <T variant="small">{[phone, inv.billTo?.address].filter(Boolean).join(' · ')}</T>
          {inv.booking?._id ? (
            <Tap
              onPress={() => nav.navigate('BookingDetail', { id: inv.booking!._id })}
              hapticOnPress={false}
              style={{ marginTop: space.sm }}
            >
              <T variant="smallStrong" gold>
                Open booking {inv.booking.bookingNumber} →
              </T>
            </Tap>
          ) : null}
          {inv.sale?._id ? (
            <Tap
              onPress={() => nav.navigate('SaleDetail', { id: inv.sale!._id })}
              hapticOnPress={false}
              style={{ marginTop: space.sm }}
            >
              <T variant="smallStrong" gold>
                Open sale #{inv.sale.billNumber} →
              </T>
            </Tap>
          ) : null}
          {inv.customisationOrder?._id ? (
            <Tap
              onPress={() =>
                nav.navigate('CustomisationDetail', {
                  id: inv.customisationOrder!._id,
                })
              }
              hapticOnPress={false}
              style={{ marginTop: space.sm }}
            >
              <T variant="smallStrong" gold>
                Open stitching order #{inv.customisationOrder.billNumber} →
              </T>
            </Tap>
          ) : null}
        </Card>
      </Section>

      <Section title="Items">
        <Card>
          {inv.lineItems.map((li, i) => (
            <Row key={i} style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
              <View style={{ flex: 1, paddingRight: space.md }}>
                <T variant="body">{li.description}</T>
                <T variant="small">
                  {li.quantity} × {inr(li.unitPrice)}
                </T>
              </View>
              <T variant="bodyStrong">{inr(li.amount)}</T>
            </Row>
          ))}
          <Divider />
          <KV label="Subtotal" value={inr(inv.subtotal)} />
          {inv.discountAmount ? <KV label="Discount" value={`− ${inr(inv.discountAmount)}`} /> : null}
          {inv.taxAmount ? <KV label={`Tax (${inv.taxRate}%)`} value={inr(inv.taxAmount)} /> : null}
          {inv.securityDeposit ? (
            <KV
              label={`Security deposit${inv.depositRefunded ? ' · refunded' : ''}`}
              value={inr(inv.securityDeposit)}
              tone={inv.depositRefunded ? 'success' : undefined}
            />
          ) : null}
          <Divider />
          <KV label="Total" value={inr(inv.total)} strong />
        </Card>
      </Section>

      <Section title={`Payments · ${inv.payments.length}`}>
        {inv.payments.length === 0 ? <T variant="small">No payments yet.</T> : null}
        {inv.payments.map((p, i) => (
          <ListRow
            key={p._id ?? i}
            icon={p.method === 'cash' ? 'Banknote' : p.method === 'card' ? 'CreditCard' : 'Wallet'}
            title={inr(p.amount)}
            subtitle={`${titleCase(p.method)}${p.kind ? ` · ${titleCase(p.kind)}` : ''}${
              p.reference ? ` · ${p.reference}` : ''
            }`}
            meta={`${fmtDateTime(p.paidAt)}${
              typeof p.recordedBy === 'object' && p.recordedBy?.name ? ` · by ${p.recordedBy.name}` : ''
            }`}
            chevron={false}
          />
        ))}
      </Section>

      {inv.stageHistory?.length ? (
        <Section title="Generated at">
          <Card>
            <T variant="small" style={{ marginBottom: space.sm }}>
              Booking stages this invoice was generated or updated at.
            </T>
            {inv.stageHistory.map((e) => (
              <KV
                key={e.stage + e.at}
                label={invoiceStageLabel(e.stage) ?? e.stage}
                value={`${fmtDate(e.at)} · ${inr(e.total)} · paid ${inr(e.amountPaid)}`}
              />
            ))}
          </Card>
        </Section>
      ) : null}

      {inv.notes ? (
        <Section title="Notes">
          <Card>
            <T variant="body">{inv.notes}</T>
          </Card>
        </Section>
      ) : null}

      <AuditHistory entityType="Invoice" entityId={inv._id} />

      <Section title="Actions">
        {inv.status === 'draft' && isManager(role) ? (
          <ListRow
            icon="Pencil"
            title="Edit invoice"
            subtitle="Drafts can be edited"
            onPress={() => nav.navigate('InvoiceForm', { id: inv._id })}
          />
        ) : null}
        {inv.status !== 'cancelled' ? (
          <ListRow
            icon="Send"
            title="Send on WhatsApp"
            subtitle="Template message with the PDF"
            onPress={() => send.mutate()}
          />
        ) : null}
        {payable ? <ListRow icon="Bell" title="Payment reminder" onPress={() => remind.mutate()} /> : null}
        {phone ? (
          <ListRow
            icon="MessageCircle"
            title="Open WhatsApp chat"
            onPress={() => whatsapp(phone, `Your Color Times invoice ${inv.invoiceNumber}: ${url}`)}
          />
        ) : null}
        {inv.securityDeposit > 0 && !inv.depositRefunded ? (
          <ListRow
            icon="Banknote"
            title="Refund security deposit"
            onPress={async () => {
              if (
                await confirm({
                  title: 'Refund the deposit?',
                  message: inr(inv.securityDeposit),
                  confirmText: 'Refund',
                })
              )
                refund.mutate();
            }}
          />
        ) : null}
        {inv.status !== 'cancelled' && inv.status !== 'paid' ? (
          <ListRow
            icon="X"
            danger
            title="Cancel invoice"
            onPress={async () => {
              if (
                await confirm({
                  title: 'Cancel this invoice?',
                  confirmText: 'Cancel invoice',
                  destructive: true,
                })
              )
                cancel.mutate();
            }}
          />
        ) : null}
        {isManager(role) ? (
          <ListRow
            icon="Trash"
            danger
            title="Move to Trash"
            onPress={async () => {
              if (
                await confirm({
                  title: 'Move invoice to Trash?',
                  confirmText: 'Move',
                  destructive: true,
                })
              )
                remove.mutate();
            }}
          />
        ) : null}
      </Section>

      <PaymentSheet
        visible={paying}
        onClose={() => setPaying(false)}
        due={inv.amountDue}
        loading={pay.isPending}
        onSubmit={(input) => pay.mutate(input)}
      />
    </Screen>
  );
}

export function InvoiceFormScreen() {
  const { id } = useParams<{ id: string }>();
  const editing = Boolean(id);
  const nav = useNav();
  const invalidate = useInvalidate();
  const existing = useApi<{ invoice: Invoice }>(id ? `/api/admin/invoices/${id}` : null);
  const [mode, setMode] = useState<'manual' | 'booking'>('manual');
  const [bookingId, setBookingId] = useState('');
  const [customerInitial, setCustomerInitial] = useState<{ value: string; label: string } | null>(null);
  const bookingOptions = useApi<{ bookings: Booking[] }>(mode === 'booking' ? '/api/admin/bookings' : null, {
    pageSize: 100,
    status: 'all',
  });
  const [customer, setCustomer] = useState('');
  const [lines, setLines] = useState([{ description: '', quantity: '1', unitPrice: '' }]);
  const [discount, setDiscount] = useState('');
  const [tax, setTax] = useState('');
  const [deposit, setDeposit] = useState('');
  const [due, setDue] = useState(isoDay(new Date(Date.now() + 7 * 86400000)));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const inv = existing.data?.invoice;
    if (!inv) return;
    setCustomer(inv.customer?._id ?? '');
    setCustomerInitial(inv.customer ? { value: inv.customer._id, label: inv.customer.name } : null);
    setLines(
      inv.lineItems.map((l) => ({
        description: l.description,
        quantity: String(l.quantity),
        unitPrice: String(l.unitPrice),
      }))
    );
    setDiscount(inv.discountAmount ? String(inv.discountAmount) : '');
    setTax(inv.taxRate ? String(inv.taxRate) : '');
    setDeposit(inv.securityDeposit ? String(inv.securityDeposit) : '');
    setDue(isoDay(new Date(inv.dueDate)));
    setNotes(inv.notes ?? '');
  }, [existing.data]);

  const fromBooking = async () => {
    if (!bookingId) return toast.error('Choose a booking');
    setBusy(true);
    try {
      const r = await api.post<{ invoice: Invoice }>('/api/admin/invoices/from-booking', { bookingId });
      invalidate('/api/admin/invoices');
      toast.success('Invoice ready');
      nav.replace('InvoiceDetail', { id: r.invoice._id });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const subtotal = lines.reduce((s, l) => s + (num(l.quantity) ?? 0) * (num(l.unitPrice) ?? 0), 0);
  const disc = Math.min(num(discount) ?? 0, subtotal);
  const taxAmt = ((subtotal - disc) * (num(tax) ?? 0)) / 100;
  const total = subtotal - disc + taxAmt + (num(deposit) ?? 0);

  const submit = async () => {
    if (!customer) return toast.error('Choose a customer');
    if (lines.some((l) => !l.description.trim())) return toast.error('Describe every line item');
    setBusy(true);
    try {
      const body = {
        customer,
        lineItems: lines.map((l) => ({
          description: l.description.trim(),
          quantity: num(l.quantity) ?? 1,
          unitPrice: num(l.unitPrice) ?? 0,
        })),
        discountAmount: num(discount) ?? 0,
        taxRate: num(tax) ?? 0,
        securityDeposit: num(deposit) ?? 0,
        dueDate: due,
        notes,
      };
      const r = editing
        ? await api.patch<{ invoice: Invoice }>(`/api/admin/invoices/${id}`, body)
        : await api.post<{ invoice: Invoice }>('/api/admin/invoices', body);
      invalidate('/api/admin/invoices');
      toast.success(editing ? 'Invoice updated' : 'Invoice created');
      if (editing) nav.goBack();
      else nav.replace('InvoiceDetail', { id: r.invoice._id });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      header={<Header title={editing ? 'Edit invoice' : 'New invoice'} />}
      footer={
        mode === 'booking' ? (
          <Button title="Generate from booking" onPress={fromBooking} loading={busy} />
        ) : (
          <Button title={`${editing ? 'Save' : 'Create'} · ${inr(total)}`} onPress={submit} loading={busy} />
        )
      }
    >
      {!editing ? (
        <Segmented
          options={[
            { value: 'manual', label: 'Manual invoice' },
            { value: 'booking', label: 'From a booking' },
          ]}
          value={mode}
          onChange={setMode}
        />
      ) : null}
      {mode === 'booking' ? (
        <>
          <SelectField
            label="Booking"
            searchable
            value={bookingId}
            onChange={setBookingId}
            options={(bookingOptions.data?.bookings ?? []).map((b) => ({
              value: b._id,
              label: `${b.bookingNumber} — ${b.customer?.name ?? ''}`,
              subtitle: b.items
                .map((i) => i.product?.name)
                .filter(Boolean)
                .join(', '),
            }))}
          />
          <T variant="small">
            Builds the bill from the booking’s dresses, rent, deposit and payments — the same as “Invoice” on
            a booking.
          </T>
        </>
      ) : (
        <>
          <CustomerPicker
            key={customerInitial?.value ?? 'new'}
            value={customer}
            initial={customerInitial}
            onChange={setCustomer}
          />
          <Section title="Line items" style={{ marginTop: space.sm }}>
            {lines.map((l, i) => (
              <Card key={i} style={{ marginBottom: space.md }}>
                <Input
                  label="Description"
                  value={l.description}
                  onChangeText={(v) =>
                    setLines((s) => s.map((x, j) => (j === i ? { ...x, description: v } : x)))
                  }
                />
                <Row gap={space.md}>
                  <Input
                    label="Qty"
                    value={l.quantity}
                    keyboardType="decimal-pad"
                    onChangeText={(v) =>
                      setLines((s) => s.map((x, j) => (j === i ? { ...x, quantity: v } : x)))
                    }
                    style={{ flex: 1 }}
                  />
                  <MoneyInput
                    label="Unit price"
                    value={l.unitPrice}
                    onChangeText={(v) =>
                      setLines((s) => s.map((x, j) => (j === i ? { ...x, unitPrice: v } : x)))
                    }
                    style={{ flex: 2 }}
                  />
                </Row>
                {lines.length > 1 ? (
                  <Button
                    title="Remove"
                    variant="ghost"
                    size="sm"
                    onPress={() => setLines((s) => s.filter((_, j) => j !== i))}
                    style={{ alignSelf: 'flex-start' }}
                  />
                ) : null}
              </Card>
            ))}
            <Button
              title="Add line"
              icon="Plus"
              variant="outline"
              onPress={() => setLines((s) => [...s, { description: '', quantity: '1', unitPrice: '' }])}
            />
          </Section>
          <Section title="Totals">
            <Row gap={space.md}>
              <MoneyInput label="Discount" value={discount} onChangeText={setDiscount} style={{ flex: 1 }} />
              <Input
                label="Tax %"
                value={tax}
                onChangeText={setTax}
                keyboardType="decimal-pad"
                style={{ flex: 1 }}
              />
            </Row>
            <MoneyInput label="Security deposit" value={deposit} onChangeText={setDeposit} />
            <DateField label="Due date" value={due} onChange={setDue} />
            <Input label="Notes" value={notes} onChangeText={setNotes} multiline />
            <Card>
              <KV label="Subtotal" value={inr(subtotal)} />
              <KV label="Tax" value={inr(taxAmt)} />
              <KV label="Total" value={inr(total)} strong />
            </Card>
          </Section>
        </>
      )}
    </Screen>
  );
}
