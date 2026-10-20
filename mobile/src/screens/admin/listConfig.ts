/**
 * Per-module export columns, bulk actions and trash settings — mirrors the
 * web admin's list toolbars (Export CSV/Excel/PDF, bulk select, Trash).
 */
import type {
  Booking,
  Category,
  CustomisationOrder,
  Customer,
  Expense,
  Invoice,
  Product,
  Purchase,
  SalaryPayment,
  Sale,
  ServiceOrder,
  StaffMember,
} from '../../api/types';
import type { BulkAction, ExportColumn } from '../../components/ui';
import { fmtDate, titleCase } from '../../lib/format';
import {
  BOOKING_STATUS,
  CUSTOMISATION_STATUS,
  EXPENSE_CATEGORY_LABELS,
  INVOICE_STATUS,
  PRODUCT_STATUS,
  SERVICE_STATUS,
} from '../../lib/labels';
import { MANAGER_ROLES } from '../../lib/roles';
import {
  bookingDepositHeld,
  bookingPaidBreakdown,
  bookingRemainingDue,
  bookingRent,
  depositStateText,
} from '../../lib/bookingMoney';

const del: BulkAction = { action: 'delete', label: 'Move to Trash', icon: 'Trash', danger: true };
const delManager: BulkAction = { ...del, roles: MANAGER_ROLES };

export const BULK = {
  bookings: [delManager],
  products: [
    { action: 'activate', label: 'Show on site', icon: 'Eye', roles: MANAGER_ROLES },
    { action: 'deactivate', label: 'Hide', icon: 'EyeOff', roles: MANAGER_ROLES },
    { action: 'archive', label: 'Archive', icon: 'Archive', roles: MANAGER_ROLES },
    del,
  ] as BulkAction[],
  customers: [del],
  categories: [del],
  expenses: [del],
  purchases: [del],
  staff: [del],
  salary: [del],
  invoices: [del],
  sales: [del],
};

export const TRASH = {
  bookings: { param: 'view' as const, roles: MANAGER_ROLES },
  invoices: { param: 'view' as const },
  sales: { param: 'view' as const },
  customers: { param: 'view' as const },
  products: { param: 'status' as const },
  categories: { param: 'status' as const },
  expenses: { param: 'status' as const },
  purchases: { param: 'status' as const },
  staff: { param: 'status' as const },
  salary: { param: 'status' as const },
  customisation: { param: 'view' as const, readOnly: true },
  services: { param: 'view' as const, readOnly: true },
};

export const EXPORTS = {
  bookings: {
    title: 'Bookings',
    filename: 'bookings',
    columns: [
      { label: 'Bill No.', value: (b) => b.billNumber },
      { label: 'Booking', value: (b) => b.bookingNumber },
      { label: 'Booked', value: (b) => fmtDate(b.bookingDate) },
      { label: 'Customer', value: (b) => b.customer?.name ?? '' },
      { label: 'Phone', value: (b) => b.customer?.phone ?? '' },
      {
        label: 'Dresses',
        value: (b) =>
          b.items
            .map((i) => i.product?.name)
            .filter(Boolean)
            .join(', '),
      },
      { label: 'Pickup', value: (b) => fmtDate(b.rentalStartDate) },
      { label: 'Return', value: (b) => fmtDate(b.rentalEndDate) },
      { label: 'Status', value: (b) => BOOKING_STATUS[b.status]?.label ?? b.status },
      { label: 'Advance', value: (b) => bookingPaidBreakdown(b).advance, total: true },
      { label: 'Due paid', value: (b) => bookingPaidBreakdown(b).duePaid, total: true },
      { label: 'Rent', value: bookingRent, total: true },
      { label: 'Security', value: (b) => b.securityDeposit, total: true },
      { label: 'Security held', value: bookingDepositHeld, total: true },
      { label: 'Deposit', value: (b) => depositStateText(b) || '—' },
      { label: 'Due', value: bookingRemainingDue, total: true },
    ] as ExportColumn<Booking>[],
  },
  products: {
    title: 'Products',
    filename: 'products',
    columns: [
      { label: 'Code', value: (p) => p.sku },
      { label: 'Name', value: (p) => p.name },
      { label: 'Category', value: (p) => p.category?.name ?? '' },
      { label: 'Colour', value: (p) => p.color },
      { label: 'Fabric', value: (p) => p.fabric },
      { label: 'Sizes', value: (p) => p.variants.map((v) => `${v.size}:${v.quantityInStock}`).join(' ') },
      { label: 'Status', value: (p) => PRODUCT_STATUS[p.status]?.label ?? p.status },
      { label: 'Rent', value: (p) => p.rentalPricePerDay },
      { label: 'Deposit', value: (p) => p.securityDeposit },
      { label: 'Retail', value: (p) => p.retailValue },
      { label: 'Visible', value: (p) => (p.isActive ? 'Yes' : 'No') },
      { label: 'Added', value: (p) => fmtDate(p.createdAt) },
    ] as ExportColumn<Product>[],
  },
  invoices: {
    title: 'Invoices',
    filename: 'invoices',
    columns: [
      { label: 'Invoice', value: (i) => i.invoiceNumber },
      { label: 'Date', value: (i) => fmtDate(i.issuedAt ?? i.createdAt) },
      { label: 'Customer', value: (i) => i.billTo?.name || i.customer?.name || '' },
      { label: 'Phone', value: (i) => i.billTo?.phone || i.customer?.phone || '' },
      { label: 'Source', value: (i) => titleCase(i.source ?? (i.booking ? 'booking' : 'manual')) },
      { label: 'Status', value: (i) => INVOICE_STATUS[i.status]?.label ?? i.status },
      { label: 'Total', value: (i) => i.total, total: true },
      { label: 'Paid', value: (i) => i.amountPaid, total: true },
      { label: 'Due', value: (i) => i.amountDue, total: true },
    ] as ExportColumn<Invoice>[],
  },
  customers: {
    title: 'Customers',
    filename: 'customers',
    columns: [
      { label: 'Name', value: (c) => c.name },
      { label: 'Email', value: (c) => c.email },
      { label: 'Phone', value: (c) => c.phone ?? '' },
      { label: 'Address', value: (c) => c.addresses?.[0]?.line1 ?? '' },
      { label: 'City', value: (c) => c.addresses?.[0]?.city ?? '' },
      { label: 'Since', value: (c) => fmtDate(c.createdAt) },
    ] as ExportColumn<Customer>[],
  },
  sales: {
    title: 'Sales',
    filename: 'sales',
    columns: [
      { label: 'Bill No.', value: (s) => s.billNumber },
      { label: 'Date', value: (s) => fmtDate(s.saleDate) },
      { label: 'Customer', value: (s) => s.customerName },
      { label: 'Phone', value: (s) => s.customerPhone },
      { label: 'Item', value: (s) => s.product?.name ?? '' },
      { label: 'Total', value: (s) => s.totalAmount, total: true },
      { label: 'Advance', value: (s) => s.advancePayment, total: true },
      { label: 'Due', value: (s) => s.dueAmount, total: true },
    ] as ExportColumn<Sale>[],
  },
  customisation: {
    title: 'Customisation orders',
    filename: 'customisation',
    columns: [
      { label: 'Bill No.', value: (o) => o.billNumber },
      { label: 'Date', value: (o) => fmtDate(o.orderDate) },
      { label: 'Customer', value: (o) => o.customerName },
      { label: 'Phone', value: (o) => o.customerPhone },
      { label: 'Stitching', value: (o) => o.stitchingType },
      { label: 'Status', value: (o) => CUSTOMISATION_STATUS[o.status]?.label ?? o.status },
      { label: 'Total', value: (o) => o.totalAmount, total: true },
      { label: 'Advance', value: (o) => o.advancePayment, total: true },
      { label: 'Due', value: (o) => o.dueAmount, total: true },
    ] as ExportColumn<CustomisationOrder>[],
  },
  services: {
    title: 'Service orders',
    filename: 'service-orders',
    columns: [
      { label: 'Type', value: (o) => (o.serviceType === 'tailor' ? 'Tailor' : 'Dry clean') },
      { label: 'Dress', value: (o) => o.product?.name ?? '' },
      { label: 'Code', value: (o) => o.product?.sku ?? '' },
      { label: 'Vendor', value: (o) => o.assignedTo ?? '' },
      { label: 'Sent', value: (o) => fmtDate(o.sentDate) },
      { label: 'Expected', value: (o) => fmtDate(o.expectedReturnDate) },
      { label: 'Status', value: (o) => SERVICE_STATUS[o.status]?.label ?? o.status },
      { label: 'Total', value: (o) => o.totalAmount, total: true },
    ] as ExportColumn<ServiceOrder>[],
  },
  expenses: {
    title: 'Expenses',
    filename: 'expenses',
    columns: [
      { label: 'Date', value: (e) => fmtDate(e.expenseDate) },
      { label: 'Category', value: (e) => EXPENSE_CATEGORY_LABELS[e.category] },
      { label: 'Description', value: (e) => e.description },
      { label: 'Paid via', value: (e) => e.paymentMethod ?? '' },
      { label: 'Amount', value: (e) => e.amount, total: true },
    ] as ExportColumn<Expense>[],
  },
  purchases: {
    title: 'Purchases',
    filename: 'purchases',
    columns: [
      { label: 'Date', value: (p) => fmtDate(p.purchaseDate) },
      { label: 'Bill', value: (p) => p.billNumber ?? '' },
      { label: 'Item', value: (p) => p.itemName },
      { label: 'Vendor', value: (p) => p.vendorName },
      { label: 'Qty', value: (p) => p.quantity },
      { label: 'Unit cost', value: (p) => p.unitCost },
      { label: 'Total', value: (p) => p.totalCost, total: true },
      { label: 'Paid', value: (p) => p.amountPaid, total: true },
      { label: 'Status', value: (p) => titleCase(p.paymentStatus) },
    ] as ExportColumn<Purchase>[],
  },
  staff: {
    title: 'Staff',
    filename: 'staff',
    columns: [
      { label: 'Name', value: (s) => s.name },
      { label: 'Designation', value: (s) => s.designation },
      { label: 'Phone', value: (s) => s.phone ?? '' },
      { label: 'Joined', value: (s) => fmtDate(s.joiningDate) },
      { label: 'Monthly salary', value: (s) => s.monthlySalary, total: true },
      { label: 'Active', value: (s) => (s.isActive ? 'Yes' : 'No') },
    ] as ExportColumn<StaffMember>[],
  },
  salary: {
    title: 'Salary payments',
    filename: 'salary-payments',
    columns: [
      { label: 'Staff', value: (p) => p.staff?.name ?? '' },
      { label: 'For month', value: (p) => p.forMonth },
      { label: 'Paid on', value: (p) => fmtDate(p.paymentDate) },
      { label: 'Method', value: (p) => titleCase(p.paymentMethod) },
      { label: 'Amount', value: (p) => p.amount, total: true },
    ] as ExportColumn<SalaryPayment>[],
  },
  categories: {
    title: 'Categories',
    filename: 'categories',
    columns: [
      { label: 'Name', value: (c) => c.name },
      { label: 'Slug', value: (c) => c.slug },
      { label: 'Order', value: (c) => c.displayOrder },
      { label: 'Featured', value: (c) => (c.isFeatured ? 'Yes' : 'No') },
    ] as ExportColumn<Category>[],
  },
};

/** Sort options — the same sortable columns as the web tables (and accepted by each API). */
export const SORTS = {
  bookings: [
    { value: 'latestActivity', label: 'Latest activity' },
    { value: 'bookingDate', label: 'Booking date' },
    { value: 'rentalStartDate', label: 'Pickup date' },
    { value: 'rentalEndDate', label: 'Return date' },
    { value: 'bookingNumber', label: 'Booking number' },
    { value: 'billNumber', label: 'Bill number' },
    { value: 'status', label: 'Status' },
    { value: 'totalAmount', label: 'Amount' },
    { value: 'advancePaid', label: 'Advance paid' },
    { value: 'securityDeposit', label: 'Security deposit' },
  ],
  invoices: [
    { value: 'createdAt', label: 'Created' },
    { value: 'dueDate', label: 'Due date' },
    { value: 'invoiceNumber', label: 'Invoice number' },
    { value: 'status', label: 'Status' },
    { value: 'total', label: 'Total' },
    { value: 'amountPaid', label: 'Amount paid' },
    { value: 'amountDue', label: 'Amount due' },
  ],
  customers: [
    { value: 'createdAt', label: 'Joined' },
    { value: 'name', label: 'Name' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
  ],
  sales: [
    { value: 'saleDate', label: 'Sale date' },
    { value: 'createdAt', label: 'Created' },
    { value: 'billNumber', label: 'Bill number' },
    { value: 'customerName', label: 'Customer' },
    { value: 'totalAmount', label: 'Total' },
    { value: 'advancePayment', label: 'Advance' },
    { value: 'dueAmount', label: 'Due' },
  ],
  orders: [
    { value: 'orderDate', label: 'Order date' },
    { value: 'billNumber', label: 'Bill number' },
    { value: 'customerName', label: 'Customer' },
    { value: 'stitchingType', label: 'Stitching type' },
    { value: 'status', label: 'Status' },
    { value: 'totalAmount', label: 'Total' },
    { value: 'advancePayment', label: 'Advance' },
    { value: 'dueAmount', label: 'Due' },
  ],
  services: [
    { value: 'sentDate', label: 'Sent date' },
    { value: 'expectedReturnDate', label: 'Expected return' },
    { value: 'description', label: 'Description' },
    { value: 'assignedTo', label: 'Assigned to' },
    { value: 'status', label: 'Status' },
    { value: 'totalAmount', label: 'Total' },
  ],
  products: [
    { value: 'createdAt', label: 'Added' },
    { value: 'updatedAt', label: 'Last updated' },
    { value: 'name', label: 'Name' },
    { value: 'sku', label: 'Code' },
    { value: 'status', label: 'Status' },
    { value: 'rentalPricePerDay', label: 'Rent' },
    { value: 'retailValue', label: 'Retail value' },
  ],
  expenses: [
    { value: 'expenseDate', label: 'Date' },
    { value: 'description', label: 'Description' },
    { value: 'category', label: 'Category' },
    { value: 'amount', label: 'Amount' },
  ],
  purchases: [
    { value: 'purchaseDate', label: 'Purchase date' },
    { value: 'billNumber', label: 'Bill number' },
    { value: 'itemName', label: 'Item' },
    { value: 'vendorName', label: 'Vendor' },
    { value: 'quantity', label: 'Quantity' },
    { value: 'totalCost', label: 'Total cost' },
    { value: 'paymentStatus', label: 'Payment status' },
  ],
  staff: [
    { value: 'name', label: 'Name' },
    { value: 'designation', label: 'Designation' },
    { value: 'phone', label: 'Phone' },
    { value: 'monthlySalary', label: 'Monthly salary' },
    { value: 'joiningDate', label: 'Joining date' },
    { value: 'isActive', label: 'Active' },
  ],
  salary: [
    { value: 'paymentDate', label: 'Payment date' },
    { value: 'forMonth', label: 'For month' },
    { value: 'amount', label: 'Amount' },
    { value: 'paymentMethod', label: 'Method' },
  ],
};
