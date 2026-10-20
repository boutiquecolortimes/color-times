import { colors, themed } from '../theme';
import type {
  BookingStatus,
  CustomisationStatus,
  ExpenseCategory,
  InvoiceStatus,
  ProductStatus,
  ServiceStatus,
} from '../api/types';

export type Tone = 'gold' | 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'rose';

/** Tone → token colour; follows the active theme. */
export const toneColor: Record<Tone, string> = themed(() => ({
  gold: colors.gold,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  info: colors.info,
  muted: colors.textFaint,
  rose: colors.rose,
}));

export const BOOKING_STATUS: Record<BookingStatus, { label: string; tone: Tone }> = {
  inquiry: { label: 'Inquiry', tone: 'info' },
  pending_payment: { label: 'Pending Payment', tone: 'warning' },
  confirmed: { label: 'Confirmed', tone: 'gold' },
  in_use: { label: 'Picked Up', tone: 'rose' },
  returned: { label: 'Returned', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'muted' },
};

export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  inquiry: ['confirmed', 'cancelled'],
  pending_payment: ['confirmed', 'cancelled'],
  confirmed: ['in_use', 'cancelled'],
  in_use: ['returned', 'cancelled'],
  returned: [],
  cancelled: [],
};

export const INVOICE_STATUS: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'muted' },
  sent: { label: 'Sent', tone: 'info' },
  partially_paid: { label: 'Part Paid', tone: 'warning' },
  paid: { label: 'Paid', tone: 'success' },
  overdue: { label: 'Overdue', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'muted' },
};

export const PRODUCT_STATUS: Record<ProductStatus, { label: string; tone: Tone }> = {
  available: { label: 'Available', tone: 'success' },
  booked: { label: 'Booked', tone: 'gold' },
  reserved: { label: 'Reserved', tone: 'gold' },
  picked_up: { label: 'Picked Up', tone: 'rose' },
  under_dry_cleaning: { label: 'Dry Cleaning', tone: 'info' },
  under_repair: { label: 'Under Repair', tone: 'warning' },
  damaged: { label: 'Damaged', tone: 'danger' },
  returned: { label: 'Returned', tone: 'success' },
  sold: { label: 'Sold', tone: 'muted' },
};

export const SERVICE_STATUS: Record<ServiceStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Pending', tone: 'warning' },
  in_progress: { label: 'In Progress', tone: 'info' },
  quality_check: { label: 'Quality Check', tone: 'gold' },
  completed: { label: 'Completed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'muted' },
};

export const CUSTOMISATION_STATUS: Record<CustomisationStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Pending', tone: 'warning' },
  in_progress: { label: 'In Progress', tone: 'info' },
  ready: { label: 'Ready', tone: 'gold' },
  delivered: { label: 'Delivered', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'muted' },
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  rent: 'Rent',
  electricity: 'Electricity',
  water: 'Water',
  maintenance: 'Maintenance',
  transport: 'Transport',
  marketing: 'Marketing',
  office_supplies: 'Office Supplies',
  miscellaneous: 'Miscellaneous',
};

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' },
] as const;

export const SALARY_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
] as const;

export const MEASUREMENT_FIELDS: { key: string; label: string }[] = [
  { key: 'bust', label: 'Bust' },
  { key: 'waist', label: 'Waist' },
  { key: 'hip', label: 'Hip' },
  { key: 'shoulder', label: 'Shoulder' },
  { key: 'sleeveLength', label: 'Sleeve length' },
  { key: 'blouseLength', label: 'Blouse length' },
  { key: 'armhole', label: 'Armhole' },
  { key: 'neckFront', label: 'Neck front' },
  { key: 'neckBack', label: 'Neck back' },
  { key: 'upperChest', label: 'Upper chest' },
  { key: 'lowerChest', label: 'Lower chest' },
  { key: 'armLength', label: 'Arm length' },
  { key: 'length', label: 'Length' },
  { key: 'thigh', label: 'Thigh' },
  { key: 'other', label: 'Other' },
];

// Why an invoice exists — port of invoiceStageLabel() in the web's lib/admin/booking-status.ts.
const INVOICE_STAGE: Record<string, string> = {
  inquiry: 'Inquiry',
  pending_payment: 'Pending Payment',
  confirmed: 'Booking Confirmed',
  in_use: 'Picked Up',
  returned: 'Returned',
  cancelled: 'Cancelled',
  sale_created: 'Sale Created',
  sale_updated: 'Sale Updated',
  order_created: 'Order Placed',
  order_updated: 'Order Updated',
  payment: 'Payment Received',
  pending: 'Pending',
  in_progress: 'In Progress',
  ready: 'Ready',
  delivered: 'Delivered',
  return_undone: 'Return Undone',
};
export function invoiceStageLabel(stage?: string | null): string | null {
  if (!stage) return null;
  return INVOICE_STAGE[stage] ?? stage;
}
