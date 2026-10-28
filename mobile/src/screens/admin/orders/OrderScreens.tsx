import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api, errorMessage } from '../../../api/client';
import { useAction, useApi, useInvalidate } from '../../../api/hooks';
import type {
  CustomisationOrder,
  CustomisationStatus,
  Customer,
  Sale,
  ServiceOrder,
  ServiceStatus,
  ServiceType,
} from '../../../api/types';
import {
  Button,
  Card,
  Chips,
  DateField,
  Divider,
  ErrorState,
  Header,
  Icon,
  IconButton,
  Img,
  Input,
  KV,
  ListRow,
  ListScreen,
  Meta,
  Loading,
  MoneyInput,
  Pill,
  ProgressSteps,
  Row,
  Screen,
  Section,
  Segmented,
  Sheet,
  T,
  Tap,
  confirm,
  toast,
} from '../../../components/ui';
import {
  CustomerPicker,
  MeasurementsEditor,
  MeasurementsView,
  ProductPicker,
  cleanMeasurements,
} from '../../../components/admin/Pickers';
import { QuickCustomerSheet } from '../../../components/admin/QuickCustomerSheet';
import { PaymentSheet } from '../../../components/admin/PaymentSheet';
import { SummaryStrip } from '../../../components/admin/SummaryStrip';
import { colors, space } from '../../../theme';
import { useNav, useParams } from '../../../navigation/nav';
import { fmtDate, inr, isoDay, num } from '../../../lib/format';
import { CUSTOMISATION_STATUS, SERVICE_STATUS } from '../../../lib/labels';
import { useRole } from '../../../auth/AuthContext';
import { isManager } from '../../../lib/roles';
import { call, openUrl, printPdf, pdfUrl, shareLink, whatsapp } from '../../../lib/share';
import { BULK, EXPORTS, SORTS, TRASH } from '../listConfig';
import { AuditHistory } from '../../../components/admin/AuditHistory';

// ============================== SALES ======================================

export function SalesScreen() {
  const nav = useNav();
  return (
    <ListScreen<Sale>
      title="Sales"
      path="/api/admin/sales"
      listKey="sales"
      bulk={BULK.sales}
      trash={TRASH.sales}
      filters={{ dateRange: { label: 'Sale date' }, sorts: SORTS.sales }}
      exporter={EXPORTS.sales}
      chipParam="payment"
      chips={[
        { value: 'all', label: 'All' },
        { value: 'due', label: 'Due' },
        { value: 'paid', label: 'Paid' },
      ]}
      counts={(meta) => meta?.paymentCounts as Record<string, number> | undefined}
      search="Bill no., customer, phone"
      onCreate={() => nav.navigate('SaleForm')}
      createLabel="Sale"
      top={(meta) => <SummaryStrip summary={meta?.summary as Record<string, unknown>} />}
      renderItem={(s) => (
        <ListRow
          leading={<Img src={s.product?.images?.[0]} style={{ width: 44, height: 56 }} rounded={8} />}
          title={s.customerName}
          subtitle={`#${s.billNumber} · ${s.product?.name ?? 'Item'}`}
          meta={fmtDate(s.saleDate)}
          right={
            <View style={{ alignItems: 'flex-end' }}>
              <T variant="bodyStrong">{inr(s.totalAmount)}</T>
              {s.dueAmount > 0 ? (
                <T variant="small" color={colors.warning}>
                  {inr(s.dueAmount)} due
                </T>
              ) : (
                <T variant="small" color={colors.success}>
                  Paid
                </T>
              )}
            </View>
          }
          chevron={false}
          onPress={() => nav.navigate('SaleDetail', { id: s._id })}
        />
      )}
      empty={{ icon: 'ShoppingBag', title: 'No sales yet' }}
    />
  );
}

export function SaleDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const nav = useNav();
  const role = useRole();
  const invalidate = useInvalidate();
  const q = useApi<{ sale: Sale }>(id ? `/api/admin/sales/${id}` : null);
  const [paying, setPaying] = useState(false);
  const refresh = () => invalidate('/api/admin/sales', '/api/admin/invoices', '/api/admin/dashboard');
  const pay = useAction((input: object) => api.post(`/api/admin/sales/${id}/payments`, input), {
    success: 'Payment recorded',
    onSuccess: () => {
      setPaying(false);
      refresh();
    },
  });
  const send = useAction(() => api.post(`/api/admin/sales/${id}/send`), {
    success: 'Bill sent on WhatsApp',
  });
  const remove = useAction(() => api.delete(`/api/admin/sales/${id}`), {
    success: 'Moved to Trash',
    onSuccess: () => {
      refresh();
      nav.goBack();
    },
  });

  if (q.isLoading)
    return (
      <Screen header={<Header title="Sale" />}>
        <Loading />
      </Screen>
    );
  const s = q.data?.sale;
  if (!s)
    return (
      <Screen header={<Header title="Sale" />}>
        <ErrorState message={errorMessage(q.error)} />
      </Screen>
    );
  const url = pdfUrl('sales', s._id);

  return (
    <Screen
      header={
        <Header
          title={`Sale #${s.billNumber}`}
          right={
            <>
              <IconButton icon="Share2" onPress={() => shareLink(`Color Times bill #${s.billNumber}`, url)} />
              <IconButton icon="FileText" onPress={() => openUrl(url)} />
              <IconButton
                icon="Printer"
                onPress={() => printPdf(url, `bill-${url.split('/').slice(-2)[0]}`)}
                accessibilityLabel="Print"
              />
            </>
          }
        />
      }
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
      footer={
        // A rental settlement's balance is collected on its booking, not here (same as the web).
        s.dueAmount > 0 && s.source !== 'booking' ? (
          <Button title={`Collect ${inr(s.dueAmount)}`} icon="Wallet" onPress={() => setPaying(true)} />
        ) : undefined
      }
    >
      <Tap
        disabled={!s.product}
        onPress={() => s.product && nav.navigate('ProductDetail', { id: s.product._id })}
        accessibilityLabel={s.product ? `Open ${s.product.name}` : undefined}
      >
        <Card>
          <Row gap={space.md}>
            <Img src={s.product?.images?.[0]} style={{ width: 70, height: 90 }} />
            <View style={{ flex: 1 }}>
              {s.source === 'booking' ? (
                <View style={{ alignSelf: 'flex-start', marginBottom: space.xs }}>
                  <Pill label="Rental settlement" tone="info" small />
                </View>
              ) : null}
              <T variant="h3">{s.product?.name ?? 'Dress no longer available'}</T>
              {s.product?.sku ? <T variant="small">{s.product.sku}</T> : null}
              <T variant="small">Sale date {fmtDate(s.saleDate)}</T>
            </View>
            {s.product ? <Icon name="ChevronRight" size={18} color={colors.textFaint} /> : null}
          </Row>
        </Card>
      </Tap>
      <Section title="Customer">
        <Card>
          <T variant="h3">{s.customerName}</T>
          <T variant="small">
            {s.customerPhone} · {s.customerAddress}
          </T>
          <Row style={{ marginTop: space.md }}>
            <Button
              title="Call"
              icon="Phone"
              size="sm"
              variant="surface"
              onPress={() => call(s.customerPhone)}
            />
            <Button
              title="WhatsApp"
              icon="MessageCircle"
              size="sm"
              variant="surface"
              onPress={() => whatsapp(s.customerPhone)}
            />
          </Row>
        </Card>
      </Section>
      <Section title="Money">
        <Card>
          <KV label="Total" value={inr(s.totalAmount)} />
          <KV label="Advance" value={inr(s.advancePayment)} />
          {s.duePaid ? <KV label="Paid later" value={inr(s.duePaid)} /> : null}
          <Divider />
          <KV label="Due" value={inr(s.dueAmount)} strong tone={s.dueAmount > 0 ? 'warning' : 'success'} />
        </Card>
      </Section>
      {s.details ? (
        <Section title="Details">
          <Card>
            <T variant="body">{s.details}</T>
          </Card>
        </Section>
      ) : null}
      <AuditHistory entityType="Sale" entityId={s._id} />

      <Section title="Actions">
        <ListRow icon="Send" title="Send bill on WhatsApp" onPress={() => send.mutate()} />
        {s.invoiceId ? (
          <ListRow
            icon="FileText"
            title="Open invoice"
            onPress={() => nav.navigate('InvoiceDetail', { id: s.invoiceId })}
          />
        ) : null}
        {isManager(role) ? (
          <ListRow icon="Pencil" title="Edit sale" onPress={() => nav.navigate('SaleForm', { id: s._id })} />
        ) : null}
        {isManager(role) ? (
          <ListRow
            icon="Trash"
            danger
            title="Move to Trash"
            onPress={async () => {
              if (
                await confirm({
                  title: 'Delete this sale?',
                  confirmText: 'Move to Trash',
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
        due={s.dueAmount}
        loading={pay.isPending}
        onSubmit={(input) => pay.mutate(input)}
      />
    </Screen>
  );
}

/** Shared "who is this for" block: pick an existing customer or type a walk-in. */
function WalkInCustomer({
  name,
  phone,
  address,
  onChange,
  customerId,
  onCustomer,
}: {
  name: string;
  phone: string;
  address: string;
  onChange: (patch: { name?: string; phone?: string; address?: string }) => void;
  customerId: string;
  onCustomer: (id: string) => void;
}) {
  const fetchCustomer = async (id: string) => {
    onCustomer(id);
    try {
      const { customer } = await api.get<{ customer: Customer }>(`/api/admin/customers/${id}`);
      onChange({
        name: customer.name,
        phone: customer.phone ?? '',
        address: customer.addresses?.[0]?.line1 ?? address,
      });
    } catch {
      // keep typed values
    }
  };
  const [quickOpen, setQuickOpen] = useState(false);
  const [picked, setPicked] = useState<{ value: string; label: string } | null>(null);
  return (
    <>
      <CustomerPicker
        key={picked?.value ?? 'none'}
        initial={picked}
        label="Existing customer"
        optional
        value={customerId}
        onChange={fetchCustomer}
      />
      <Button
        title="New customer"
        icon="Plus"
        variant="ghost"
        size="sm"
        style={{ alignSelf: 'flex-start', marginTop: -space.sm, marginBottom: space.md }}
        onPress={() => setQuickOpen(true)}
      />
      <QuickCustomerSheet
        visible={quickOpen}
        onClose={() => setQuickOpen(false)}
        onCreated={(c) => {
          setPicked({ value: c._id, label: c.name });
          onCustomer(c._id);
          onChange({ name: c.name, phone: c.phone, address: c.address || address });
        }}
      />
      <Input
        label="Name"
        value={name}
        onChangeText={(v) => onChange({ name: v })}
        required
        autoCapitalize="words"
      />
      <Input
        label="Mobile"
        value={phone}
        onChangeText={(v) => onChange({ phone: v })}
        required
        keyboardType="phone-pad"
        prefix="+91"
      />
      <Input label="Address" value={address} onChangeText={(v) => onChange({ address: v })} required />
    </>
  );
}

export function SaleFormScreen() {
  const { id } = useParams<{ id: string }>();
  const editing = Boolean(id);
  const nav = useNav();
  const invalidate = useInvalidate();
  const q = useApi<{ sale: Sale }>(id ? `/api/admin/sales/${id}` : null);
  const next = useApi<{ billNumber: string }>(editing ? null : '/api/admin/bill-number');
  const [f, setF] = useState({
    billNumber: '',
    saleDate: isoDay(),
    customer: '',
    name: '',
    phone: '',
    address: '',
    product: '',
    productLabel: '',
    details: '',
    total: '',
    advance: '',
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (next.data && !f.billNumber) setF((s) => ({ ...s, billNumber: next.data!.billNumber }));
  }, [next.data, f.billNumber]);
  useEffect(() => {
    const s = q.data?.sale;
    if (!s) return;
    setF({
      billNumber: s.billNumber,
      saleDate: isoDay(new Date(s.saleDate)),
      customer: s.customer ?? '',
      name: s.customerName,
      phone: s.customerPhone,
      address: s.customerAddress,
      product: s.product?._id ?? '',
      productLabel: s.product?.name ?? '',
      details: s.details ?? '',
      total: String(s.totalAmount),
      advance: String(s.advancePayment),
    });
  }, [q.data]);

  const submit = async () => {
    if (!f.product) return toast.error('Choose the item sold');
    setBusy(true);
    const body = {
      billNumber: f.billNumber,
      saleDate: f.saleDate,
      customerName: f.name,
      customerPhone: f.phone,
      customerAddress: f.address,
      customer: f.customer,
      product: f.product,
      details: f.details,
      totalAmount: num(f.total) ?? 0,
      advancePayment: num(f.advance) ?? 0,
    };
    try {
      const r = editing
        ? await api.patch<{ sale: Sale }>(`/api/admin/sales/${id}`, body)
        : await api.post<{ sale: Sale }>('/api/admin/sales', body);
      invalidate('/api/admin/sales', '/api/admin/products', '/api/admin/invoices', '/api/admin/bill-number');
      toast.success(editing ? 'Sale updated' : 'Sale recorded');
      if (editing) nav.goBack();
      else nav.replace('SaleDetail', { id: r.sale._id });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (editing && q.isLoading)
    return (
      <Screen header={<Header title="Edit sale" />}>
        <Loading />
      </Screen>
    );
  return (
    <Screen
      header={<Header title={editing ? 'Edit sale' : 'New sale'} />}
      footer={<Button title={editing ? 'Save' : 'Record sale'} onPress={submit} loading={busy} />}
    >
      <Row gap={space.md}>
        <Input
          label="Bill no."
          value={f.billNumber}
          onChangeText={(v) => setF((s) => ({ ...s, billNumber: v }))}
          required
          style={{ flex: 1 }}
        />
        <DateField
          label="Date"
          value={f.saleDate}
          onChange={(v) => setF((s) => ({ ...s, saleDate: v }))}
          style={{ flex: 1 }}
        />
      </Row>
      <ProductPicker
        label="Item sold"
        value={f.product}
        initial={f.product ? { value: f.product, label: f.productLabel } : null}
        onChange={(pid, product, option) =>
          setF((s) => ({
            ...s,
            product: pid,
            productLabel: option.label,
            total: s.total || String(product?.retailValue ?? ''),
          }))
        }
      />
      <Section title="Customer">
        <WalkInCustomer
          name={f.name}
          phone={f.phone}
          address={f.address}
          customerId={f.customer}
          onCustomer={(cid) => setF((s) => ({ ...s, customer: cid }))}
          onChange={(p) =>
            setF((s) => ({
              ...s,
              ...(p.name !== undefined ? { name: p.name } : {}),
              ...(p.phone !== undefined ? { phone: p.phone } : {}),
              ...(p.address !== undefined ? { address: p.address } : {}),
            }))
          }
        />
      </Section>
      <Section title="Payment">
        <Row gap={space.md}>
          <MoneyInput
            label="Total"
            value={f.total}
            onChangeText={(v) => setF((s) => ({ ...s, total: v }))}
            required
            style={{ flex: 1 }}
          />
          <MoneyInput
            label="Paid now"
            value={f.advance}
            onChangeText={(v) => setF((s) => ({ ...s, advance: v }))}
            style={{ flex: 1 }}
          />
        </Row>
        <KV label="Due" value={inr(Math.max(0, (num(f.total) ?? 0) - (num(f.advance) ?? 0)))} strong />
        <Input
          label="Details"
          value={f.details}
          onChangeText={(v) => setF((s) => ({ ...s, details: v }))}
          multiline
          style={{ marginTop: space.md }}
        />
      </Section>
    </Screen>
  );
}

// ========================== CUSTOMISATION ==================================

const CUST_FLOW: CustomisationStatus[] = ['pending', 'in_progress', 'ready', 'delivered'];

export function CustomisationScreen() {
  const nav = useNav();
  return (
    <ListScreen<CustomisationOrder>
      title="Customisation"
      subtitle="Made-to-measure stitching"
      path="/api/admin/customisation-orders"
      listKey="orders"
      filters={{ dateRange: { label: 'Order date' }, sorts: SORTS.orders }}
      exporter={EXPORTS.customisation}
      trash={TRASH.customisation}
      chips={[
        { value: 'all', label: 'All' },
        ...CUST_FLOW.map((s) => ({
          value: s,
          label: CUSTOMISATION_STATUS[s].label,
        })),
        { value: 'cancelled', label: 'Cancelled' },
      ]}
      search="Bill no., customer, phone"
      onCreate={() => nav.navigate('CustomisationForm')}
      createLabel="Order"
      top={(meta) => <SummaryStrip summary={meta?.summary as Record<string, unknown>} />}
      renderItem={(o) => {
        const st = CUSTOMISATION_STATUS[o.status];
        return (
          <ListRow
            icon="Ruler"
            title={o.customerName}
            subtitle={`#${o.billNumber} · ${o.stitchingType}`}
            meta={fmtDate(o.orderDate)}
            right={
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <T variant="bodyStrong">{inr(o.totalAmount)}</T>
                <Pill label={st.label} tone={st.tone} small />
              </View>
            }
            chevron={false}
            onPress={() => nav.navigate('CustomisationDetail', { id: o._id })}
          />
        );
      }}
      empty={{ icon: 'Ruler', title: 'No stitching orders' }}
    />
  );
}

export function CustomisationDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const nav = useNav();
  const role = useRole();
  const invalidate = useInvalidate();
  const q = useApi<{ order: CustomisationOrder }>(id ? `/api/admin/customisation-orders/${id}` : null);
  const [paying, setPaying] = useState(false);
  const refresh = () => invalidate('/api/admin/customisation-orders', '/api/admin/invoices');
  const setStatus = useAction(
    (status: CustomisationStatus) => api.patch(`/api/admin/customisation-orders/${id}`, { status }),
    { success: 'Status updated', onSuccess: refresh }
  );
  const pay = useAction(
    (input: object) => api.post(`/api/admin/customisation-orders/${id}/payments`, input),
    {
      success: 'Payment recorded',
      onSuccess: () => {
        setPaying(false);
        refresh();
      },
    }
  );
  const send = useAction(() => api.post(`/api/admin/customisation-orders/${id}/send`), {
    success: 'Bill sent on WhatsApp',
  });
  const remove = useAction(() => api.delete(`/api/admin/customisation-orders/${id}`), {
    success: 'Moved to Trash',
    onSuccess: () => {
      refresh();
      nav.goBack();
    },
  });

  if (q.isLoading)
    return (
      <Screen header={<Header title="Order" />}>
        <Loading />
      </Screen>
    );
  const o = q.data?.order;
  if (!o)
    return (
      <Screen header={<Header title="Order" />}>
        <ErrorState message={errorMessage(q.error)} />
      </Screen>
    );
  const st = CUSTOMISATION_STATUS[o.status];
  const canEdit = isManager(role);
  const url = pdfUrl('customisation-orders', o._id);
  const idx = CUST_FLOW.indexOf(o.status);
  const nextStatus = idx >= 0 && idx < CUST_FLOW.length - 1 ? CUST_FLOW[idx + 1] : null;

  return (
    <Screen
      header={
        <Header
          title={`Order #${o.billNumber}`}
          right={
            <>
              <IconButton
                icon="Share2"
                onPress={() => shareLink(`Color Times stitching bill #${o.billNumber}`, url)}
              />
              <IconButton icon="FileText" onPress={() => openUrl(url)} />
              <IconButton
                icon="Printer"
                onPress={() => printPdf(url, `bill-${url.split('/').slice(-2)[0]}`)}
                accessibilityLabel="Print"
              />
            </>
          }
        />
      }
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
      footer={
        o.dueAmount > 0 && o.status !== 'cancelled' ? (
          <Button title={`Collect ${inr(o.dueAmount)}`} icon="Wallet" onPress={() => setPaying(true)} />
        ) : nextStatus && canEdit ? (
          <Button
            title={`Mark ${CUSTOMISATION_STATUS[nextStatus].label}`}
            onPress={() => setStatus.mutate(nextStatus)}
            loading={setStatus.isPending}
          />
        ) : undefined
      }
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <Pill label={st.label} tone={st.tone} />
        <T variant="small">Ordered {fmtDate(o.orderDate)}</T>
      </Row>
      <View style={{ marginTop: space.lg }}>
        <ProgressSteps
          steps={CUST_FLOW.map((k) => ({ key: k, label: CUSTOMISATION_STATUS[k].label }))}
          current={o.status}
          cancelled={o.status === 'cancelled'}
        />
      </View>
      <Section title="Customer">
        <Card>
          <T variant="h3">{o.customerName}</T>
          <T variant="small">
            {o.customerPhone} · {o.customerAddress}
          </T>
          <Row style={{ marginTop: space.md }}>
            <Button
              title="Call"
              icon="Phone"
              size="sm"
              variant="surface"
              onPress={() => call(o.customerPhone)}
            />
            <Button
              title="WhatsApp"
              icon="MessageCircle"
              size="sm"
              variant="surface"
              onPress={() => whatsapp(o.customerPhone)}
            />
          </Row>
        </Card>
      </Section>
      <Section title="Work">
        <Card>
          <KV label="Stitching" value={o.stitchingType} />
          <T variant="body" style={{ marginTop: space.sm }}>
            {o.detail}
          </T>
        </Card>
      </Section>
      <Section title="Measurements">
        <Card>
          <MeasurementsView value={o.measurements as Record<string, string>} />
        </Card>
      </Section>
      <Section title="Money">
        <Card>
          <KV label="Total" value={inr(o.totalAmount)} />
          <KV label="Advance" value={inr(o.advancePayment)} />
          {o.duePaid ? <KV label="Paid later" value={inr(o.duePaid)} /> : null}
          <Divider />
          <KV label="Due" value={inr(o.dueAmount)} strong tone={o.dueAmount > 0 ? 'warning' : 'success'} />
        </Card>
      </Section>
      {canEdit ? (
        <Section title="Status">
          <Segmented
            options={CUST_FLOW.map((s) => ({
              value: s,
              label: CUSTOMISATION_STATUS[s].label.split(' ')[0],
            }))}
            value={o.status === 'cancelled' ? 'pending' : o.status}
            onChange={(s) => setStatus.mutate(s)}
          />
        </Section>
      ) : null}
      <AuditHistory entityType="CustomisationOrder" entityId={o._id} />

      <Section title="Actions">
        <ListRow icon="Send" title="Send bill on WhatsApp" onPress={() => send.mutate()} />
        {canEdit ? (
          <ListRow
            icon="Pencil"
            title="Edit order"
            onPress={() => nav.navigate('CustomisationForm', { id: o._id })}
          />
        ) : null}
        {canEdit && o.status !== 'cancelled' && o.status !== 'delivered' ? (
          <ListRow
            icon="X"
            danger
            title="Cancel order"
            onPress={async () => {
              if (
                await confirm({
                  title: 'Cancel this order?',
                  destructive: true,
                  confirmText: 'Cancel order',
                })
              )
                setStatus.mutate('cancelled');
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
                  title: 'Delete order?',
                  destructive: true,
                  confirmText: 'Move to Trash',
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
        due={o.dueAmount}
        allowMarkDelivered
        loading={pay.isPending}
        onSubmit={(input) => pay.mutate(input)}
      />
    </Screen>
  );
}

export function CustomisationFormScreen() {
  const { id } = useParams<{ id: string }>();
  const editing = Boolean(id);
  const nav = useNav();
  const invalidate = useInvalidate();
  const q = useApi<{ order: CustomisationOrder }>(id ? `/api/admin/customisation-orders/${id}` : null);
  const next = useApi<{ billNumber: string }>(editing ? null : '/api/admin/bill-number');
  const [f, setF] = useState({
    billNumber: '',
    orderDate: isoDay(),
    customer: '',
    name: '',
    phone: '',
    address: '',
    stitchingType: '',
    detail: '',
    total: '',
    advance: '',
    notes: '',
  });
  const [measurements, setMeasurements] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (next.data && !f.billNumber) setF((s) => ({ ...s, billNumber: next.data!.billNumber }));
  }, [next.data, f.billNumber]);
  useEffect(() => {
    const o = q.data?.order;
    if (!o) return;
    setF({
      billNumber: o.billNumber,
      orderDate: isoDay(new Date(o.orderDate)),
      customer: '',
      name: o.customerName,
      phone: o.customerPhone,
      address: o.customerAddress,
      stitchingType: o.stitchingType,
      detail: o.detail,
      total: String(o.totalAmount),
      advance: String(o.advancePayment),
      notes: o.notes ?? '',
    });
    setMeasurements((o.measurements as Record<string, string>) ?? {});
  }, [q.data]);

  const submit = async () => {
    setBusy(true);
    const body = {
      billNumber: f.billNumber,
      orderDate: f.orderDate,
      customerName: f.name,
      customerPhone: f.phone,
      customerAddress: f.address,
      customer: f.customer,
      stitchingType: f.stitchingType,
      detail: f.detail,
      measurements: cleanMeasurements(measurements),
      totalAmount: num(f.total) ?? 0,
      advancePayment: num(f.advance) ?? 0,
      notes: f.notes,
    };
    try {
      const r = editing
        ? await api.patch<{ order: CustomisationOrder }>(`/api/admin/customisation-orders/${id}`, body)
        : await api.post<{ order: CustomisationOrder }>('/api/admin/customisation-orders', body);
      invalidate('/api/admin/customisation-orders', '/api/admin/invoices', '/api/admin/bill-number');
      toast.success(editing ? 'Order updated' : 'Order created');
      if (editing) nav.goBack();
      else nav.replace('CustomisationDetail', { id: r.order._id });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (editing && q.isLoading)
    return (
      <Screen header={<Header title="Edit order" />}>
        <Loading />
      </Screen>
    );
  return (
    <Screen
      header={<Header title={editing ? 'Edit order' : 'New stitching order'} />}
      footer={<Button title={editing ? 'Save' : 'Create order'} onPress={submit} loading={busy} />}
    >
      <Row gap={space.md}>
        <Input
          label="Bill no."
          value={f.billNumber}
          onChangeText={set('billNumber')}
          required
          style={{ flex: 1 }}
        />
        <DateField label="Date" value={f.orderDate} onChange={set('orderDate')} style={{ flex: 1 }} />
      </Row>
      <Section title="Customer" style={{ marginTop: 0 }}>
        <WalkInCustomer
          name={f.name}
          phone={f.phone}
          address={f.address}
          customerId={f.customer}
          onCustomer={set('customer')}
          onChange={(p) =>
            setF((s) => ({
              ...s,
              ...(p.name !== undefined ? { name: p.name } : {}),
              ...(p.phone !== undefined ? { phone: p.phone } : {}),
              ...(p.address !== undefined ? { address: p.address } : {}),
            }))
          }
        />
      </Section>
      <Section title="Work">
        <Input
          label="Stitching type"
          value={f.stitchingType}
          onChangeText={set('stitchingType')}
          required
          placeholder="Blouse, lehenga, suit…"
        />
        <Input label="Detail" value={f.detail} onChangeText={set('detail')} required multiline />
      </Section>
      <Section title="Measurements">
        <MeasurementsEditor value={measurements} onChange={setMeasurements} />
      </Section>
      <Section title="Payment">
        <Row gap={space.md}>
          <MoneyInput
            label="Total"
            value={f.total}
            onChangeText={set('total')}
            required
            style={{ flex: 1 }}
          />
          <MoneyInput label="Advance" value={f.advance} onChangeText={set('advance')} style={{ flex: 1 }} />
        </Row>
        <Input label="Notes" value={f.notes} onChangeText={set('notes')} multiline />
      </Section>
    </Screen>
  );
}

// ============================ SERVICES =====================================

const SERVICE_FLOW: ServiceStatus[] = ['pending', 'in_progress', 'quality_check', 'completed'];

export function ServicesScreen() {
  const nav = useNav();
  const invalidate = useInvalidate();
  const [type, setType] = useState<'all' | ServiceType>('all');
  const [statusFor, setStatusFor] = useState<ServiceOrder | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const changeStatus = async (status: ServiceStatus) => {
    if (!statusFor) return;
    setSavingStatus(true);
    try {
      await api.patch(`/api/admin/service-orders/${statusFor._id}`, { status });
      toast.success(`Marked ${SERVICE_STATUS[status].label.toLowerCase()}`);
      invalidate('/api/admin/service-orders', '/api/admin/products');
      setStatusFor(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSavingStatus(false);
    }
  };
  return (
    <View style={{ flex: 1 }}>
      <ListScreen<ServiceOrder>
        key={type}
        title="Dry clean & tailor"
        path="/api/admin/service-orders"
        listKey="orders"
        filters={{ dateRange: { label: 'Sent date' }, sorts: SORTS.services }}
        exporter={EXPORTS.services}
        trash={TRASH.services}
        query={{ serviceType: type === 'all' ? undefined : type }}
        chips={[
          { value: 'all', label: 'All' },
          ...SERVICE_FLOW.map((s) => ({
            value: s,
            label: SERVICE_STATUS[s].label,
          })),
          { value: 'cancelled', label: 'Cancelled' },
        ]}
        search="Dress, booking, vendor"
        onCreate={() => nav.navigate('ServiceForm')}
        createLabel="Service"
        top={() => (
          <Segmented
            options={[
              { value: 'all', label: 'All' },
              { value: 'dry_clean', label: 'Dry clean' },
              { value: 'tailor', label: 'Tailor' },
            ]}
            value={type}
            onChange={setType}
          />
        )}
        renderItem={(o) => {
          const st = SERVICE_STATUS[o.status];
          const late =
            o.status !== 'completed' &&
            o.status !== 'cancelled' &&
            new Date(o.expectedReturnDate) < new Date();
          return (
            <ListRow
              leading={<Img src={o.product?.images?.[0]} style={{ width: 44, height: 56 }} rounded={8} />}
              title={o.product?.name ?? 'Dress'}
              subtitle={`${o.serviceType === 'tailor' ? 'Tailor' : 'Dry clean'}${
                o.assignedTo ? ` · ${o.assignedTo}` : ''
              }`}
              meta={`Back ${fmtDate(o.expectedReturnDate)}${late ? ' · LATE' : ''}`}
              right={
                o.deletedAt || o.status === 'completed' || o.status === 'cancelled' ? (
                  <Pill label={st.label} tone={late ? 'danger' : st.tone} small />
                ) : (
                  <Tap onPress={() => setStatusFor(o)} accessibilityLabel="Change status" hitSlop={8}>
                    <Pill label={`${st.label} ▾`} tone={late ? 'danger' : st.tone} small />
                  </Tap>
                )
              }
              chevron={false}
              onPress={() => nav.navigate('ServiceDetail', { id: o._id })}
            />
          );
        }}
        empty={{ icon: 'Droplets', title: 'No service orders' }}
      />
      <Sheet
        visible={Boolean(statusFor)}
        onClose={() => setStatusFor(null)}
        title={statusFor?.product?.name ?? 'Change status'}
      >
        {[...SERVICE_FLOW, 'cancelled' as ServiceStatus].map((value) => (
          <Button
            key={value}
            title={SERVICE_STATUS[value].label}
            variant={statusFor?.status === value ? 'gold' : value === 'cancelled' ? 'danger' : 'outline'}
            disabled={statusFor?.status === value || savingStatus}
            style={{ marginBottom: space.sm }}
            onPress={() => changeStatus(value)}
          />
        ))}
      </Sheet>
    </View>
  );
}

export function ServiceDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const nav = useNav();
  const role = useRole();
  const invalidate = useInvalidate();
  const q = useApi<{ order: ServiceOrder }>(id ? `/api/admin/service-orders/${id}` : null);
  const setStatus = useAction(
    (status: ServiceStatus) => api.patch(`/api/admin/service-orders/${id}`, { status }),
    {
      success: 'Status updated',
      onSuccess: () => invalidate('/api/admin/service-orders', '/api/admin/products'),
    }
  );
  const remove = useAction(() => api.delete(`/api/admin/service-orders/${id}`), {
    success: 'Deleted',
    onSuccess: () => {
      invalidate('/api/admin/service-orders');
      nav.goBack();
    },
  });
  if (q.isLoading)
    return (
      <Screen header={<Header title="Service" />}>
        <Loading />
      </Screen>
    );
  const o = q.data?.order;
  if (!o)
    return (
      <Screen header={<Header title="Service" />}>
        <ErrorState message={errorMessage(q.error)} />
      </Screen>
    );
  const st = SERVICE_STATUS[o.status];
  const canEdit = isManager(role);
  const idx = SERVICE_FLOW.indexOf(o.status);
  const next = canEdit && idx >= 0 && idx < SERVICE_FLOW.length - 1 ? SERVICE_FLOW[idx + 1] : null;
  return (
    <Screen
      header={<Header title={o.serviceType === 'tailor' ? 'Tailor order' : 'Dry-clean order'} />}
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
      footer={
        next ? (
          <Button
            title={`Mark ${SERVICE_STATUS[next].label}`}
            onPress={() => setStatus.mutate(next)}
            loading={setStatus.isPending}
          />
        ) : undefined
      }
    >
      <Card>
        <Row gap={space.md}>
          <Img src={o.product?.images?.[0]} style={{ width: 70, height: 90 }} />
          <View style={{ flex: 1 }}>
            <T variant="h3">{o.product?.name}</T>
            <T variant="small">{o.product?.sku}</T>
            <Row gap={space.sm} style={{ flexWrap: 'wrap', marginTop: space.xs }}>
              <Pill label={st.label} tone={st.tone} small />
              {o.status !== 'completed' &&
              o.status !== 'cancelled' &&
              new Date(o.expectedReturnDate) < new Date() ? (
                <Meta label="Overdue" tone="danger" />
              ) : null}
            </Row>
          </View>
        </Row>
        <View style={{ marginTop: space.lg }}>
          <ProgressSteps
            steps={SERVICE_FLOW.map((k) => ({ key: k, label: SERVICE_STATUS[k].label }))}
            current={o.status}
            cancelled={o.status === 'cancelled'}
          />
        </View>
      </Card>
      <Section title="Details">
        <Card>
          <T variant="body">{o.description}</T>
          <Divider />
          <KV label="Sent" value={fmtDate(o.sentDate)} />
          <KV label="Expected back" value={fmtDate(o.expectedReturnDate)} />
          {o.completedDate ? <KV label="Completed" value={fmtDate(o.completedDate)} /> : null}
          {o.assignedTo ? <KV label="Vendor / tailor" value={o.assignedTo} /> : null}
          {o.booking ? (
            <KV label="Booking" value={o.booking.bookingNumber} />
          ) : o.bookingBillNumberRef ? (
            <KV label="Bill ref" value={o.bookingBillNumberRef} />
          ) : null}
          {o.stitchingType ? <KV label="Stitching" value={o.stitchingType} /> : null}
        </Card>
      </Section>
      <Section title="Charges">
        <Card>
          {o.dryCleanCharge ? <KV label="Dry clean" value={inr(o.dryCleanCharge)} /> : null}
          {o.ironCharge ? <KV label="Iron" value={inr(o.ironCharge)} /> : null}
          {o.stitchingCharge ? <KV label="Stitching" value={inr(o.stitchingCharge)} /> : null}
          {o.otherCharge ? <KV label="Other" value={inr(o.otherCharge)} /> : null}
          <Divider />
          <KV label="Total" value={inr(o.totalAmount)} strong />
        </Card>
      </Section>
      {o.notes ? (
        <Section title="Notes">
          <Card>
            <T>{o.notes}</T>
          </Card>
        </Section>
      ) : null}
      {canEdit ? (
        <Section title="Status">
          <Chips
            options={SERVICE_FLOW.map((s) => ({
              value: s,
              label: SERVICE_STATUS[s].label,
            }))}
            value={o.status}
            onChange={(s) => setStatus.mutate(s)}
            style={{ marginHorizontal: -space.lg }}
          />
        </Section>
      ) : null}
      <AuditHistory entityType="ServiceOrder" entityId={o._id} />

      <Section title="Actions">
        {canEdit ? (
          <ListRow
            icon="Pencil"
            title="Edit service order"
            onPress={() => nav.navigate('ServiceForm', { id: o._id })}
          />
        ) : null}
        {o.product?._id ? (
          <ListRow
            icon="Shirt"
            title="Open dress"
            onPress={() => nav.navigate('ProductDetail', { id: o.product!._id })}
          />
        ) : null}
        {canEdit && o.status !== 'cancelled' && o.status !== 'completed' ? (
          <ListRow icon="X" danger title="Cancel" onPress={() => setStatus.mutate('cancelled')} />
        ) : null}
        {isManager(role) ? (
          <ListRow
            icon="Trash"
            danger
            title="Delete"
            onPress={async () => {
              if (
                await confirm({
                  title: 'Delete service order?',
                  destructive: true,
                  confirmText: 'Delete',
                })
              )
                remove.mutate();
            }}
          />
        ) : null}
      </Section>
    </Screen>
  );
}

export function ServiceFormScreen() {
  const { productId, productName, id, bookingId, bookingRef, description } = useParams<{
    productId: string;
    productName: string;
    id: string;
    /** Launched from a returned booking's "Send to dry clean". */
    bookingId: string;
    bookingRef: string;
    description: string;
  }>();
  const editing = Boolean(id);
  const nav = useNav();
  const invalidate = useInvalidate();
  const existing = useApi<{ order: ServiceOrder }>(id ? `/api/admin/service-orders/${id}` : null);
  const [type, setType] = useState<ServiceType>('dry_clean');
  const [product, setProduct] = useState(productId ?? '');
  const [productInitial, setProductInitial] = useState<{ value: string; label: string } | null>(
    productId ? { value: productId, label: productName ?? 'Dress' } : null
  );
  // Same service for several dresses at once (web: "additional dresses").
  const [extra, setExtra] = useState<{ key: string; id: string }[]>([]);
  const [f, setF] = useState({
    description: description ?? '',
    dryClean: '',
    iron: '',
    stitching: '',
    stitchingType: '',
    other: '',
    assignedTo: '',
    bookingRef: bookingRef ?? '',
    sent: isoDay(),
    expected: isoDay(new Date(Date.now() + 3 * 86400000)),
    notes: '',
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const o = existing.data?.order;
    if (!o) return;
    setType(o.serviceType);
    setProduct(o.product?._id ?? '');
    setProductInitial(o.product ? { value: o.product._id, label: o.product.name } : null);
    setF({
      description: o.description,
      dryClean: o.dryCleanCharge ? String(o.dryCleanCharge) : '',
      iron: o.ironCharge ? String(o.ironCharge) : '',
      stitching: o.stitchingCharge ? String(o.stitchingCharge) : '',
      stitchingType: o.stitchingType ?? '',
      other: o.otherCharge ? String(o.otherCharge) : '',
      assignedTo: o.assignedTo ?? '',
      bookingRef: o.bookingBillNumberRef ?? '',
      sent: isoDay(new Date(o.sentDate)),
      expected: isoDay(new Date(o.expectedReturnDate)),
      notes: o.notes ?? '',
    });
  }, [existing.data]);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const total =
    type === 'dry_clean'
      ? (num(f.dryClean) ?? 0) + (num(f.iron) ?? 0) + (num(f.other) ?? 0)
      : (num(f.stitching) ?? 0) + (num(f.other) ?? 0);

  const submit = async () => {
    if (!product) return toast.error('Choose a dress');
    setBusy(true);
    try {
      const body = {
        serviceType: type,
        product,
        ...(editing ? {} : { additionalProducts: extra.map((x) => x.id).filter(Boolean) }),
        ...(bookingId && !editing ? { booking: bookingId } : {}),
        description: f.description || (type === 'tailor' ? 'Tailoring' : 'Dry clean'),
        dryCleanCharge: type === 'dry_clean' ? num(f.dryClean) ?? 0 : undefined,
        ironCharge: type === 'dry_clean' ? num(f.iron) ?? 0 : undefined,
        stitchingCharge: type === 'tailor' ? num(f.stitching) ?? 0 : undefined,
        stitchingType: type === 'tailor' ? f.stitchingType : undefined,
        otherCharge: num(f.other),
        assignedTo: f.assignedTo,
        bookingBillNumberRef: f.bookingRef || undefined,
        sentDate: f.sent,
        expectedReturnDate: f.expected,
        notes: f.notes,
      };
      const r = editing
        ? await api.patch<{ order: ServiceOrder }>(`/api/admin/service-orders/${id}`, body)
        : await api.post<{ order: ServiceOrder }>('/api/admin/service-orders', body);
      invalidate('/api/admin/service-orders', '/api/admin/products');
      toast.success(
        editing
          ? 'Service order updated'
          : extra.length
          ? `${extra.length + 1} service orders created`
          : 'Service order created'
      );
      if (editing) nav.goBack();
      else nav.replace('ServiceDetail', { id: r.order._id });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      header={<Header title={editing ? 'Edit service order' : 'New service order'} />}
      footer={
        <Button title={`${editing ? 'Save' : 'Create'} · ${inr(total)}`} onPress={submit} loading={busy} />
      }
    >
      <Segmented
        options={[
          { value: 'dry_clean', label: 'Dry clean' },
          { value: 'tailor', label: 'Tailor' },
        ]}
        value={type}
        onChange={setType}
      />
      <ProductPicker
        key={productInitial?.value ?? 'p'}
        value={product}
        initial={productInitial}
        onChange={(pid) => setProduct(pid)}
      />
      {!editing ? (
        <>
          {extra.map((x, i) => (
            <Row key={x.key} gap={space.sm}>
              <View style={{ flex: 1 }}>
                <ProductPicker
                  label={`Dress ${i + 2}`}
                  value={x.id}
                  onChange={(pid) => setExtra((l) => l.map((y) => (y.key === x.key ? { ...y, id: pid } : y)))}
                />
              </View>
              <IconButton
                icon="X"
                size={32}
                onPress={() => setExtra((l) => l.filter((y) => y.key !== x.key))}
              />
            </Row>
          ))}
          <Button
            title="Add another dress"
            icon="Plus"
            variant="ghost"
            size="sm"
            style={{ alignSelf: 'flex-start', marginBottom: space.md }}
            onPress={() => setExtra((l) => [...l, { key: Math.random().toString(36).slice(2), id: '' }])}
          />
        </>
      ) : null}
      <Input label="Description" value={f.description} onChangeText={set('description')} required multiline />
      {type === 'dry_clean' ? (
        <Row gap={space.md}>
          <MoneyInput
            label="Dry clean"
            value={f.dryClean}
            onChangeText={set('dryClean')}
            required
            style={{ flex: 1 }}
          />
          <MoneyInput label="Iron" value={f.iron} onChangeText={set('iron')} required style={{ flex: 1 }} />
        </Row>
      ) : (
        <Row gap={space.md}>
          <Input
            label="Stitching type"
            value={f.stitchingType}
            onChangeText={set('stitchingType')}
            required
            style={{ flex: 1 }}
          />
          <MoneyInput
            label="Charge"
            value={f.stitching}
            onChangeText={set('stitching')}
            required
            style={{ flex: 1 }}
          />
        </Row>
      )}
      <MoneyInput label="Other charge" value={f.other} onChangeText={set('other')} />
      <Row gap={space.md}>
        <DateField label="Sent" value={f.sent} onChange={set('sent')} style={{ flex: 1 }} />
        <DateField label="Expected back" value={f.expected} onChange={set('expected')} style={{ flex: 1 }} />
      </Row>
      <Input label="Vendor / tailor" value={f.assignedTo} onChangeText={set('assignedTo')} />
      <Input label="Booking bill no." hint="Optional" value={f.bookingRef} onChangeText={set('bookingRef')} />
      <Input label="Notes" value={f.notes} onChangeText={set('notes')} multiline />
    </Screen>
  );
}
