import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api, errorMessage } from '../../../api/client';
import { useApi, useInvalidate } from '../../../api/hooks';
import type {
  Expense,
  ExpenseCategory,
  Purchase,
  SalaryPayment,
  StaffMember,
  TeamUser,
  UserRole,
} from '../../../api/types';
import {
  Avatar,
  Button,
  Card,
  Chips,
  DateField,
  Divider,
  ErrorState,
  Header,
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
  Sheet,
  T,
  ToggleRow,
  confirm,
  toast,
} from '../../../components/ui';
import { ProductPicker } from '../../../components/admin/Pickers';
import { colors, space } from '../../../theme';
import { useNav, useParams } from '../../../navigation/nav';
import { fmtDate, inr, isoDay, isoMonth, num, titleCase } from '../../../lib/format';
import { EXPENSE_CATEGORY_LABELS, SALARY_METHODS } from '../../../lib/labels';
import { ROLE_LABELS, isManager } from '../../../lib/roles';
import { useAuth } from '../../../auth/AuthContext';
import { shareLink } from '../../../lib/share';
import { BULK, EXPORTS, TRASH, SORTS } from '../listConfig';
import Clipboard from '@react-native-clipboard/clipboard';

function copyPassword(password: string) {
  Clipboard.setString(password);
  toast.success('Password copied', 'Paste it to the team member privately.');
}

// ================================ TEAM =====================================
// App/web logins for staff — Manager+ only (API enforces it too).

const TEAM_ROLES: UserRole[] = ['staff', 'admin', 'developer', 'super_admin'];

export function TeamScreen() {
  const { user } = useAuth();
  const invalidate = useInvalidate();
  const [editing, setEditing] = useState<Partial<TeamUser> | null>(null);
  const [busy, setBusy] = useState(false);
  const [roleFilter, setRoleFilter] = useState('');

  const removeUser = async (u: TeamUser) => {
    if (
      !(await confirm({
        title: `Remove ${u.name}?`,
        message: 'They lose access to the admin and the app immediately.',
        confirmText: 'Remove',
        destructive: true,
      }))
    )
      return;
    try {
      await api.delete(`/api/admin/users/${u._id}`);
      invalidate('/api/admin/users');
      toast.success('Team member removed');
      setEditing(null);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  // Only a super admin / developer can hand out the top roles.
  const assignable = TEAM_ROLES.filter(
    (r) => user?.role === 'super_admin' || user?.role === 'developer' || r === 'staff' || r === 'admin'
  );

  const save = async () => {
    if (!editing?.name?.trim()) return toast.error('Name is required');
    setBusy(true);
    try {
      if (editing._id) {
        await api.patch(`/api/admin/users/${editing._id}`, {
          name: editing.name,
          phone: editing.phone ?? '',
          role: editing.role,
          isActive: editing.isActive,
        });
        toast.success('Team member updated');
      } else {
        const r = await api.post<{ user: TeamUser; temporaryPassword: string }>('/api/admin/users', {
          name: editing.name,
          email: editing.email,
          phone: editing.phone ?? '',
          role: editing.role ?? 'staff',
        });
        await confirm({
          title: 'Account created',
          message: `Temporary password for ${r.user.email}:\n\n${r.temporaryPassword}\n\nShare it privately — they'll change it after signing in.`,
          confirmText: 'Share',
          cancelText: 'Copy password',
        }).then((share) => {
          if (share)
            shareLink(
              `Your Color Times login\nEmail: ${r.user.email}\nTemporary password: ${r.temporaryPassword}`
            );
          else copyPassword(r.temporaryPassword);
        });
      }
      invalidate('/api/admin/users');
      setEditing(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (u: TeamUser) => {
    if (
      !(await confirm({
        title: `Reset ${u.name}'s password?`,
        message: 'They will be signed out on every device.',
        confirmText: 'Reset',
        destructive: true,
      }))
    )
      return;
    try {
      const r = await api.post<{ temporaryPassword: string }>(`/api/admin/users/${u._id}/reset-password`);
      const share = await confirm({
        title: 'New temporary password',
        message: r.temporaryPassword,
        confirmText: 'Share',
        cancelText: 'Copy password',
      });
      if (share) shareLink(`Your new Color Times password: ${r.temporaryPassword}`);
      else copyPassword(r.temporaryPassword);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <>
      <ListScreen<TeamUser>
        key={roleFilter}
        query={{ role: roleFilter || undefined }}
        top={() => (
          <Chips
            options={[
              { value: '', label: 'All roles' },
              ...TEAM_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })),
            ]}
            value={roleFilter}
            onChange={setRoleFilter}
            style={{ marginHorizontal: -space.lg, marginBottom: space.md }}
          />
        )}
        title="Team"
        subtitle="Who can sign in to the admin"
        path="/api/admin/users"
        listKey="users"
        chips={[
          { value: 'all', label: 'All' },
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Disabled' },
        ]}
        search="Name or email"
        onCreate={() => setEditing({ name: '', email: '', role: 'staff', isActive: true })}
        createLabel="Member"
        renderItem={(u) => (
          <ListRow
            leading={<Avatar name={u.name} />}
            title={u.name}
            subtitle={u.email}
            right={
              <Pill
                label={u.isActive ? ROLE_LABELS[u.role] : 'Disabled'}
                tone={u.isActive ? 'gold' : 'muted'}
                small
              />
            }
            chevron={false}
            onPress={() => setEditing(u)}
          />
        )}
      />
      <Sheet
        visible={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?._id ? 'Team member' : 'Invite team member'}
        footer={
          <View style={{ gap: space.sm }}>
            <Button title={editing?._id ? 'Save' : 'Create account'} onPress={save} loading={busy} />
            {editing?._id && editing._id !== user?.sub ? (
              <Button
                title="Reset password"
                variant="outline"
                onPress={() => resetPassword(editing as TeamUser)}
              />
            ) : null}
            {editing?._id && editing._id !== user?.sub ? (
              <Button
                title="Remove team member"
                variant="danger"
                onPress={() => removeUser(editing as TeamUser)}
              />
            ) : null}
          </View>
        }
      >
        <Input
          label="Name"
          value={editing?.name ?? ''}
          onChangeText={(v) => setEditing((s) => ({ ...s, name: v }))}
          required
        />
        <Input
          label="Email"
          value={editing?.email ?? ''}
          onChangeText={(v) => setEditing((s) => ({ ...s, email: v }))}
          editable={!editing?._id}
          keyboardType="email-address"
          autoCapitalize="none"
          required
        />
        <Input
          label="Mobile"
          value={editing?.phone ?? ''}
          onChangeText={(v) => setEditing((s) => ({ ...s, phone: v }))}
          keyboardType="phone-pad"
        />
        <SelectField
          label="Role"
          value={editing?.role ?? 'staff'}
          onChange={(v) => setEditing((s) => ({ ...s, role: v as UserRole }))}
          options={assignable.map((r) => ({
            value: r,
            label: ROLE_LABELS[r],
            subtitle:
              r === 'staff'
                ? 'Day-to-day: bookings, billing, customers'
                : r === 'admin'
                ? '+ edit records, team, staff, expenses, purchases'
                : '+ settings & WhatsApp',
          }))}
        />
        {editing?._id ? (
          <ToggleRow
            label="Account active"
            value={editing.isActive !== false}
            onChange={(v) => setEditing((s) => ({ ...s, isActive: v }))}
          />
        ) : null}
      </Sheet>
    </>
  );
}

// =============================== STAFF =====================================
// Payroll records (people on the shop floor), separate from app logins.

export function StaffScreen() {
  const nav = useNav();
  return (
    <ListScreen<StaffMember>
      title="Staff & salary"
      path="/api/admin/staff"
      filters={{ sorts: SORTS.staff }}
      listKey="staff"
      bulk={BULK.staff}
      trash={TRASH.staff}
      exporter={EXPORTS.staff}
      search={false}
      onCreate={() => nav.navigate('StaffDetail', { create: true })}
      createLabel="Staff"
      headerRight={
        <Button title="Payments" size="sm" variant="surface" onPress={() => nav.navigate('SalaryPayments')} />
      }
      renderItem={(s) => (
        <ListRow
          leading={<Avatar name={s.name} />}
          title={s.name}
          subtitle={`${s.designation || 'Staff'} · ${inr(s.monthlySalary)}/mo`}
          meta={`Joined ${fmtDate(s.joiningDate)}`}
          right={!s.isActive ? <Pill label="Inactive" tone="muted" small /> : undefined}
          onPress={() => nav.navigate('StaffDetail', { id: s._id })}
        />
      )}
      empty={{ icon: 'IdCard', title: 'No staff added' }}
    />
  );
}

export function StaffDetailScreen() {
  const { id, create } = useParams<{ id: string; create: boolean }>();
  const nav = useNav();
  const invalidate = useInvalidate();
  const list = useApi<{ staff: StaffMember[] }>(id ? '/api/admin/staff' : null, { all: 'true' });
  const payments = useApi<{ payments: SalaryPayment[] }>(id ? '/api/admin/salary-payments' : null, {
    staff: id,
    all: 'true',
  });
  const member = list.data?.staff.find((s) => s._id === id);
  const [f, setF] = useState<{
    name: string;
    phone: string;
    designation: string;
    monthlySalary: string;
    joiningDate: string;
    isActive: boolean;
    notes: string;
  } | null>(
    create
      ? {
          name: '',
          phone: '',
          designation: '',
          monthlySalary: '',
          joiningDate: isoDay(),
          isActive: true,
          notes: '',
        }
      : null
  );
  const [paying, setPaying] = useState(false);
  const [editingPayment, setEditingPayment] = useState<SalaryPayment | null>(null);
  const [busy, setBusy] = useState(false);

  if (id && list.isLoading)
    return (
      <Screen header={<Header title="Staff" />}>
        <Loading />
      </Screen>
    );
  if (id && !member && !f)
    return (
      <Screen header={<Header title="Staff" />}>
        <ErrorState message="Staff member not found" />
      </Screen>
    );

  const startEdit = () =>
    member &&
    setF({
      name: member.name,
      phone: member.phone ?? '',
      designation: member.designation ?? '',
      monthlySalary: String(member.monthlySalary),
      joiningDate: isoDay(new Date(member.joiningDate)),
      isActive: member.isActive,
      notes: member.notes ?? '',
    });

  const save = async () => {
    if (!f?.name.trim()) return toast.error('Name is required');
    setBusy(true);
    try {
      const body = { ...f, monthlySalary: num(f.monthlySalary) ?? 0 };
      if (id) await api.patch(`/api/admin/staff/${id}`, body);
      else await api.post('/api/admin/staff', body);
      invalidate('/api/admin/staff');
      toast.success('Saved');
      if (id) setF(null);
      else nav.goBack();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (f) {
    return (
      <Screen
        header={<Header title={id ? 'Edit staff' : 'New staff'} />}
        footer={<Button title="Save" onPress={save} loading={busy} />}
      >
        <Input label="Name" value={f.name} onChangeText={(v) => setF({ ...f, name: v })} required />
        <Input
          label="Designation"
          value={f.designation}
          onChangeText={(v) => setF({ ...f, designation: v })}
          placeholder="Tailor, sales…"
        />
        <Input
          label="Mobile"
          value={f.phone}
          onChangeText={(v) => setF({ ...f, phone: v })}
          keyboardType="phone-pad"
        />
        <MoneyInput
          label="Monthly salary"
          value={f.monthlySalary}
          onChangeText={(v) => setF({ ...f, monthlySalary: v })}
          required
        />
        <DateField
          label="Joining date"
          value={f.joiningDate}
          onChange={(v) => setF({ ...f, joiningDate: v })}
        />
        <ToggleRow
          label="Currently employed"
          value={f.isActive}
          onChange={(v) => setF({ ...f, isActive: v })}
        />
        <Input label="Notes" value={f.notes} onChangeText={(v) => setF({ ...f, notes: v })} multiline />
      </Screen>
    );
  }

  const paid = payments.data?.payments ?? [];
  const thisMonth = paid.filter((p) => p.forMonth === isoMonth()).reduce((s, p) => s + p.amount, 0);

  return (
    <Screen
      header={
        <Header
          title={member!.name}
          subtitle={member!.designation}
          right={<Button title="Edit" size="sm" variant="surface" onPress={startEdit} />}
        />
      }
      footer={<Button title="Pay salary" icon="Wallet" onPress={() => setPaying(true)} />}
      refreshing={payments.isRefetching}
      onRefresh={() => payments.refetch()}
    >
      <Row gap={space.sm}>
        <Card style={{ flex: 1 }}>
          <T variant="caption">Monthly</T>
          <T variant="number">{inr(member!.monthlySalary)}</T>
        </Card>
        <Card style={{ flex: 1 }}>
          <T variant="caption">Paid this month</T>
          <T variant="number" color={thisMonth >= member!.monthlySalary ? colors.success : colors.warning}>
            {inr(thisMonth)}
          </T>
        </Card>
      </Row>
      <Section title="Details">
        <Card>
          <KV label="Phone" value={member!.phone || '—'} />
          <KV label="Joined" value={fmtDate(member!.joiningDate)} />
          <KV label="Status" value={member!.isActive ? 'Active' : 'Inactive'} />
          {member!.notes ? (
            <T variant="small" style={{ marginTop: space.sm }}>
              {member!.notes}
            </T>
          ) : null}
        </Card>
      </Section>
      <Section title="Salary history">
        {paid.length === 0 ? <T variant="small">No payments recorded.</T> : null}
        {paid.map((p) => (
          <ListRow
            key={p._id}
            icon="Banknote"
            title={inr(p.amount)}
            subtitle={`For ${p.forMonth} · ${p.paymentMethod}`}
            meta={fmtDate(p.paymentDate)}
            onPress={() => {
              setEditingPayment(p);
              setPaying(true);
            }}
          />
        ))}
      </Section>
      <Section title="Manage">
        <ListRow
          icon="Trash"
          danger
          title="Move staff member to Trash"
          onPress={async () => {
            if (
              !(await confirm({
                title: `Remove ${member!.name}?`,
                message: 'Their salary history is kept.',
                confirmText: 'Move to Trash',
                destructive: true,
              }))
            )
              return;
            try {
              await api.delete(`/api/admin/staff/${member!._id}`);
              invalidate('/api/admin/staff');
              toast.success('Moved to Trash');
              nav.goBack();
            } catch (e) {
              toast.error(errorMessage(e));
            }
          }}
        />
      </Section>
      <SalarySheet
        visible={paying}
        onClose={() => {
          setPaying(false);
          setEditingPayment(null);
        }}
        staff={member!}
        payment={editingPayment}
        onDone={() => payments.refetch()}
      />
    </Screen>
  );
}

function SalarySheet({
  visible,
  onClose,
  staff,
  onDone,
  payment,
}: {
  visible: boolean;
  onClose: () => void;
  staff: { _id: string; name: string; monthlySalary?: number };
  onDone: () => void;
  payment?: SalaryPayment | null;
}) {
  const invalidate = useInvalidate();
  const [amount, setAmount] = useState(String(payment?.amount ?? staff.monthlySalary ?? ''));
  const [month, setMonth] = useState(payment?.forMonth ?? isoMonth());
  const [date, setDate] = useState(payment ? isoDay(new Date(payment.paymentDate)) : isoDay());
  const [method, setMethod] = useState(payment?.paymentMethod ?? 'cash');
  const [notes, setNotes] = useState(payment?.notes ?? '');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setAmount(String(payment?.amount ?? staff.monthlySalary ?? ''));
    setMonth(payment?.forMonth ?? isoMonth());
    setDate(payment ? isoDay(new Date(payment.paymentDate)) : isoDay());
    setMethod(payment?.paymentMethod ?? 'cash');
    setNotes(payment?.notes ?? '');
  }, [visible, payment, staff.monthlySalary]);
  const remove = async () => {
    if (
      !payment ||
      !(await confirm({ title: 'Delete this salary payment?', confirmText: 'Delete', destructive: true }))
    )
      return;
    try {
      await api.delete(`/api/admin/salary-payments/${payment._id}`);
      invalidate('/api/admin/salary-payments');
      toast.success('Payment moved to Trash');
      onDone();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const submit = async () => {
    setBusy(true);
    try {
      const body = {
        staff: staff._id,
        amount: num(amount) ?? 0,
        forMonth: month,
        paymentDate: date,
        paymentMethod: method,
        notes,
      };
      if (payment) await api.patch(`/api/admin/salary-payments/${payment._id}`, body);
      else await api.post('/api/admin/salary-payments', body);
      invalidate('/api/admin/salary-payments');
      toast.success(payment ? 'Payment updated' : 'Salary recorded');
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
      title={payment ? `Edit payment · ${staff.name}` : `Pay ${staff.name}`}
      footer={
        <View style={{ gap: space.sm }}>
          <Button title={payment ? 'Save' : 'Record payment'} onPress={submit} loading={busy} />
          {payment ? <Button title="Delete payment" variant="danger" onPress={remove} /> : null}
        </View>
      }
    >
      <MoneyInput label="Amount" value={amount} onChangeText={setAmount} required />
      <Input label="For month" hint="YYYY-MM" value={month} onChangeText={setMonth} />
      <DateField label="Paid on" value={date} onChange={setDate} />
      <SelectField
        label="Method"
        value={method}
        onChange={setMethod}
        options={SALARY_METHODS.map((m) => ({ ...m }))}
      />
      <Input label="Notes" value={notes} onChangeText={setNotes} />
    </Sheet>
  );
}

export function SalaryPaymentsScreen() {
  const staffList = useApi<{ staff: StaffMember[] }>('/api/admin/staff', { all: 'true' });
  const [staffId, setStaffId] = useState('');
  const [editing, setEditing] = useState<SalaryPayment | null>(null);
  const months = Array.from({ length: 6 }, (_, i) =>
    isoMonth(new Date(new Date().getFullYear(), new Date().getMonth() - i, 1))
  );
  return (
    <>
      <ListScreen<SalaryPayment>
        key={staffId}
        title="Salary payments"
        path="/api/admin/salary-payments"
        filters={{ sorts: SORTS.salary }}
        listKey="payments"
        bulk={BULK.salary}
        trash={TRASH.salary}
        exporter={EXPORTS.salary}
        search={false}
        query={{ sortBy: 'paymentDate', sortDir: 'desc', staff: staffId || undefined }}
        chipParam="forMonth"
        chips={[{ value: '', label: 'All months' }, ...months.map((m) => ({ value: m, label: m }))]}
        top={() => (
          <SelectField
            label="Staff member"
            value={staffId}
            onChange={setStaffId}
            options={[
              { value: '', label: 'Everyone' },
              ...(staffList.data?.staff ?? []).map((m) => ({
                value: m._id,
                label: m.name,
                subtitle: m.designation,
              })),
            ]}
          />
        )}
        renderItem={(p) => (
          <ListRow
            icon="Banknote"
            title={p.staff?.name ?? 'Staff'}
            subtitle={`For ${p.forMonth} · ${titleCase(p.paymentMethod)}`}
            meta={fmtDate(p.paymentDate)}
            right={<T variant="bodyStrong">{inr(p.amount)}</T>}
            chevron={false}
            onPress={() => setEditing(p)}
          />
        )}
        empty={{ icon: 'Banknote', title: 'No salary payments' }}
      />
      {editing?.staff ? (
        <SalarySheet
          visible
          onClose={() => setEditing(null)}
          staff={editing.staff}
          payment={editing}
          onDone={() => {}}
        />
      ) : null}
    </>
  );
}

// ============================== EXPENSES ===================================

const EXPENSE_CATS = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[];

export function ExpensesScreen() {
  const invalidate = useInvalidate();
  const methods = useApi<{ settings: { options: string[] } }>('/api/admin/settings/payment-methods');
  const [editing, setEditing] = useState<(Partial<Expense> & { amountText?: string }) | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!editing?.description?.trim()) return toast.error('Describe the expense');
    setBusy(true);
    const body = {
      category: editing.category ?? 'miscellaneous',
      description: editing.description,
      amount: num(editing.amountText ?? '') ?? 0,
      expenseDate: editing.expenseDate ? editing.expenseDate.slice(0, 10) : isoDay(),
      paymentMethod: editing.paymentMethod ?? '',
      notes: editing.notes ?? '',
    };
    try {
      if (editing._id) await api.patch(`/api/admin/expenses/${editing._id}`, body);
      else await api.post('/api/admin/expenses', body);
      invalidate('/api/admin/expenses', '/api/admin/reports');
      toast.success('Expense saved');
      setEditing(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (
      !editing?._id ||
      !(await confirm({ title: 'Delete expense?', destructive: true, confirmText: 'Delete' }))
    )
      return;
    try {
      await api.delete(`/api/admin/expenses/${editing._id}`);
      invalidate('/api/admin/expenses');
      setEditing(null);
      toast.success('Deleted');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <>
      <ListScreen<Expense>
        title="Expenses"
        path="/api/admin/expenses"
        filters={{ sorts: SORTS.expenses }}
        listKey="expenses"
        bulk={BULK.expenses}
        trash={TRASH.expenses}
        exporter={EXPORTS.expenses}
        search={false}
        query={{ sortBy: 'expenseDate', sortDir: 'desc' }}
        chipParam="category"
        chips={[
          { value: '', label: 'All' },
          ...EXPENSE_CATS.map((c) => ({ value: c, label: EXPENSE_CATEGORY_LABELS[c] })),
        ]}
        onCreate={() => setEditing({ category: 'miscellaneous', expenseDate: isoDay(), amountText: '' })}
        createLabel="Expense"
        renderItem={(e) => (
          <ListRow
            icon="Receipt"
            title={e.description}
            subtitle={`${EXPENSE_CATEGORY_LABELS[e.category]}${
              e.paymentMethod ? ` · ${e.paymentMethod}` : ''
            }`}
            meta={fmtDate(e.expenseDate)}
            right={<T variant="bodyStrong">{inr(e.amount)}</T>}
            chevron={false}
            onPress={() => setEditing({ ...e, amountText: String(e.amount) })}
          />
        )}
        empty={{ icon: 'Receipt', title: 'No expenses recorded' }}
      />
      <Sheet
        visible={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?._id ? 'Edit expense' : 'New expense'}
        footer={
          <View style={{ gap: space.sm }}>
            <Button title="Save" onPress={save} loading={busy} />
            {editing?._id ? <Button title="Delete" variant="danger" onPress={remove} /> : null}
          </View>
        }
      >
        <SelectField
          label="Category"
          value={editing?.category ?? 'miscellaneous'}
          onChange={(v) => setEditing((s) => ({ ...s, category: v as ExpenseCategory }))}
          options={EXPENSE_CATS.map((c) => ({ value: c, label: EXPENSE_CATEGORY_LABELS[c] }))}
        />
        <Input
          label="Description"
          value={editing?.description ?? ''}
          onChangeText={(v) => setEditing((s) => ({ ...s, description: v }))}
          required
        />
        <MoneyInput
          label="Amount"
          value={editing?.amountText ?? ''}
          onChangeText={(v) => setEditing((s) => ({ ...s, amountText: v }))}
          required
        />
        <DateField
          label="Date"
          value={(editing?.expenseDate ?? isoDay()).slice(0, 10)}
          onChange={(v) => setEditing((s) => ({ ...s, expenseDate: v }))}
        />
        <SelectField
          label="Paid via"
          value={editing?.paymentMethod ?? ''}
          onChange={(v) => setEditing((s) => ({ ...s, paymentMethod: v }))}
          options={(methods.data?.settings?.options ?? ['Cash', 'Online']).map((o) => ({
            value: o,
            label: o,
          }))}
        />
        <Input
          label="Notes"
          value={editing?.notes ?? ''}
          onChangeText={(v) => setEditing((s) => ({ ...s, notes: v }))}
          multiline
        />
      </Sheet>
    </>
  );
}

// ============================== PURCHASES ==================================

export function PurchasesScreen() {
  const nav = useNav();
  return (
    <ListScreen<Purchase>
      title="Purchases"
      subtitle="Stock bought from dealers"
      path="/api/admin/purchases"
      filters={{ sorts: SORTS.purchases }}
      listKey="purchases"
      bulk={BULK.purchases}
      trash={TRASH.purchases}
      exporter={EXPORTS.purchases}
      search={false}
      query={{ sortBy: 'purchaseDate', sortDir: 'desc' }}
      onCreate={() => nav.navigate('PurchaseForm')}
      createLabel="Purchase"
      menu={[
        {
          label: 'Dealer parcel (many dresses)',
          icon: 'PackagePlus',
          onPress: () => nav.navigate('PurchaseParcel'),
        },
      ]}
      renderItem={(p) => (
        <ListRow
          icon="PackagePlus"
          title={p.itemName}
          subtitle={`${p.vendorName} · ${p.quantity} × ${inr(p.unitCost)}`}
          meta={`${fmtDate(p.purchaseDate)}${p.billNumber ? ` · Bill ${p.billNumber}` : ''}${
            p.product ? ` · ${p.product.sku}` : ''
          }`}
          right={
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <T variant="bodyStrong">{inr(p.totalCost)}</T>
              <Pill
                label={titleCase(p.paymentStatus)}
                tone={
                  p.paymentStatus === 'paid'
                    ? 'success'
                    : p.paymentStatus === 'partial'
                    ? 'warning'
                    : 'danger'
                }
                small
              />
            </View>
          }
          chevron={false}
          onPress={() => nav.navigate('PurchaseForm', { id: p._id })}
        />
      )}
      empty={{ icon: 'PackagePlus', title: 'No purchases recorded' }}
    />
  );
}

export function PurchaseFormScreen() {
  const { id } = useParams<{ id: string }>();
  const editing = Boolean(id);
  const nav = useNav();
  const role = useAuth().user?.role;
  const invalidate = useInvalidate();
  const list = useApi<{ purchases: Purchase[] }>(id ? '/api/admin/purchases' : null, { all: 'true' });
  const existing = list.data?.purchases.find((x) => x._id === id);
  const [f, setF] = useState({
    itemName: '',
    vendorName: '',
    vendorContact: '',
    product: '',
    productLabel: '',
    variantSize: '',
    quantity: '1',
    unitCost: '',
    purchaseDate: isoDay(),
    paymentStatus: 'paid',
    amountPaid: '',
    addToStock: true,
    notes: '',
  });
  const [busy, setBusy] = useState(false);
  const total = (num(f.quantity) ?? 0) * (num(f.unitCost) ?? 0);
  const readOnly = editing && !isManager(role);

  useEffect(() => {
    if (!existing) return;
    setF({
      itemName: existing.itemName,
      vendorName: existing.vendorName,
      vendorContact: existing.vendorContact ?? '',
      product: existing.product?._id ?? '',
      productLabel: existing.product?.name ?? '',
      variantSize: existing.variantSize ?? '',
      quantity: String(existing.quantity),
      unitCost: String(existing.unitCost),
      purchaseDate: isoDay(new Date(existing.purchaseDate)),
      paymentStatus: existing.paymentStatus,
      amountPaid: String(existing.amountPaid ?? ''),
      addToStock: existing.addedToStock,
      notes: existing.notes ?? '',
    });
  }, [existing]);

  const submit = async () => {
    if (!f.itemName.trim() || !f.vendorName.trim()) return toast.error('Item and vendor are required');
    setBusy(true);
    const rest: Partial<typeof f> = { ...f };
    delete rest.productLabel;
    const body = {
      ...rest,
      quantity: Math.max(1, Math.round(num(f.quantity) ?? 1)),
      unitCost: num(f.unitCost) ?? 0,
      amountPaid: f.paymentStatus === 'paid' ? total : num(f.amountPaid) ?? 0,
      addToStock: Boolean(f.product) && f.addToStock,
    };
    try {
      if (editing) await api.patch(`/api/admin/purchases/${id}`, body);
      else await api.post('/api/admin/purchases', body);
      invalidate('/api/admin/purchases', '/api/admin/products');
      toast.success(editing ? 'Purchase updated' : 'Purchase recorded');
      nav.goBack();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (
      !(await confirm({
        title: 'Delete this purchase?',
        message: 'It moves to Trash.',
        confirmText: 'Delete',
        destructive: true,
      }))
    )
      return;
    try {
      await api.delete(`/api/admin/purchases/${id}`);
      invalidate('/api/admin/purchases');
      toast.success('Moved to Trash');
      nav.goBack();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  if (editing && list.isLoading)
    return (
      <Screen header={<Header title="Purchase" />}>
        <Loading />
      </Screen>
    );

  return (
    <Screen
      header={<Header title={editing ? (readOnly ? 'Purchase' : 'Edit purchase') : 'New purchase'} />}
      footer={
        readOnly ? undefined : (
          <View style={{ gap: space.sm }}>
            <Button
              title={`${editing ? 'Save' : 'Record'} · ${inr(total)}`}
              onPress={submit}
              loading={busy}
            />
            {editing ? <Button title="Delete" variant="danger" onPress={remove} /> : null}
          </View>
        )
      }
    >
      <Input
        label="Item"
        value={f.itemName}
        onChangeText={(v) => setF({ ...f, itemName: v })}
        required
        editable={!readOnly}
      />
      <Row gap={space.md}>
        <Input
          label="Vendor / dealer"
          value={f.vendorName}
          onChangeText={(v) => setF({ ...f, vendorName: v })}
          required
          editable={!readOnly}
          style={{ flex: 1 }}
        />
        <Input
          label="Contact"
          value={f.vendorContact}
          onChangeText={(v) => setF({ ...f, vendorContact: v })}
          keyboardType="phone-pad"
          editable={!readOnly}
          style={{ flex: 1 }}
        />
      </Row>
      <Row gap={space.md}>
        <Input
          label="Qty"
          value={f.quantity}
          onChangeText={(v) => setF({ ...f, quantity: v })}
          keyboardType="number-pad"
          editable={!readOnly}
          style={{ flex: 1 }}
        />
        <MoneyInput
          label="Unit cost"
          value={f.unitCost}
          onChangeText={(v) => setF({ ...f, unitCost: v })}
          required
          editable={!readOnly}
          style={{ flex: 2 }}
        />
      </Row>
      <DateField
        label="Purchase date"
        value={f.purchaseDate}
        onChange={(v) => setF({ ...f, purchaseDate: v })}
      />
      <T variant="caption" style={{ marginBottom: 6 }}>
        Payment
      </T>
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
          editable={!readOnly}
        />
      ) : null}
      <Section title="Link to catalogue (optional)">
        <ProductPicker
          key={f.productLabel || 'none'}
          label="Existing dress"
          value={f.product}
          initial={f.product ? { value: f.product, label: f.productLabel || 'Dress' } : null}
          onChange={(pid, _p, option) => setF({ ...f, product: pid, productLabel: option.label })}
        />
        {f.product ? (
          <>
            <Input
              label="Size"
              value={f.variantSize}
              onChangeText={(v) => setF({ ...f, variantSize: v })}
              editable={!readOnly}
            />
            {!editing ? (
              <ToggleRow
                label="Add quantity to stock"
                value={f.addToStock}
                onChange={(v) => setF({ ...f, addToStock: v })}
              />
            ) : null}
            {editing && existing?.addedToStock ? <T variant="small">Already added to stock.</T> : null}
          </>
        ) : null}
      </Section>
      <Input
        label="Notes"
        value={f.notes}
        onChangeText={(v) => setF({ ...f, notes: v })}
        multiline
        editable={!readOnly}
        style={{ marginTop: space.lg }}
      />
      <Divider />
      <KV label="Total" value={inr(total)} strong />
    </Screen>
  );
}
