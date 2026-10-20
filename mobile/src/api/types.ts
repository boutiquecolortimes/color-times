/** Shapes returned by the Color Times API (mirrors models/ in the web app). */

export type UserRole = 'customer' | 'staff' | 'admin' | 'developer' | 'super_admin';

export interface SessionUser {
  sub: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Ref {
  _id: string;
  name: string;
  [key: string]: unknown;
}

export interface Measurements {
  bust?: string;
  waist?: string;
  hip?: string;
  shoulder?: string;
  sleeveLength?: string;
  blouseLength?: string;
  armhole?: string;
  neckFront?: string;
  neckBack?: string;
  upperChest?: string;
  lowerChest?: string;
  armLength?: string;
  length?: string;
  thigh?: string;
  other?: string;
}

export type BookingStatus = 'inquiry' | 'pending_payment' | 'confirmed' | 'in_use' | 'returned' | 'cancelled';
export type ReturnCondition = 'good' | 'minor_damage' | 'major_damage' | 'missing_items';

export interface BookingItem {
  product: { _id: string; name: string; images: string[]; sku?: string } | null;
  color: string;
  size: string;
  quantity: number;
  pricePerDay: number;
  rentalFee: number;
  wearerName?: string;
  measurements?: Measurements;
}

export interface Booking {
  _id: string;
  bookingNumber: string;
  billNumber: string;
  bookingDate: string;
  customer: { _id: string; name: string; email: string; phone?: string } | null;
  items: BookingItem[];
  rentalStartDate: string;
  rentalEndDate: string;
  eventDate: string;
  status: BookingStatus;
  securityDeposit: number;
  totalAmount: number;
  advancePaid: number;
  pickupPaid?: number;
  advancePaymentMethod?: string;
  measurements?: Measurements;
  deliveryAddress?: string;
  notes?: string;
  returnCondition?: ReturnCondition;
  returnNotes?: string;
  returnedAt?: string | null;
  dryCleaningRequired?: boolean;
  stitchingRequired?: boolean;
  damageCharges?: number;
  pendingRentAmount?: number;
  depositRefundAmount?: number;
  depositRefunded?: boolean;
  depositRefundedAt?: string | null;
  finalSettlementAmount?: number;
  reviewRequestedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
}

export type ProductStatus =
  | 'available'
  | 'booked'
  | 'reserved'
  | 'picked_up'
  | 'under_dry_cleaning'
  | 'under_repair'
  | 'damaged'
  | 'returned'
  | 'sold';

export interface Product {
  _id: string;
  name: string;
  slug: string;
  sku: string;
  category: { _id: string; name: string; slug: string } | null;
  designer?: string;
  dealerName?: string;
  description: string;
  color: string;
  fabric: string;
  dressType?: string;
  work?: string;
  images: string[];
  variants: { size: string; quantityInStock: number }[];
  status: ProductStatus;
  rentalPricePerDay: number;
  retailValue: number;
  purchasePrice?: number;
  stitchingCost?: number;
  transportCost?: number;
  otherCost?: number;
  securityDeposit: number;
  isFeatured: boolean;
  isNewArrival: boolean;
  isActive: boolean;
  averageRating: number;
  reviewCount: number;
  tags: string[];
  isFavorited?: boolean;
  archivedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  description: string;
  heroImage: string;
  displayOrder: number;
  isFeatured: boolean;
  deletedAt?: string | null;
  createdAt?: string;
}

export interface Customer {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  fatherName?: string;
  isActive?: boolean;
  addresses?: {
    label: string;
    line1: string;
    city: string;
    state: string;
    postalCode: string;
    isDefault: boolean;
  }[];
  createdAt: string;
  bookingCount?: number;
  [key: string]: unknown;
}

export type InvoiceStatus = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
export type PaymentMethod = 'cash' | 'card' | 'upi' | 'bank_transfer' | 'other';

export interface InvoicePayment {
  _id?: string;
  kind?: 'advance' | 'due' | 'manual';
  amount: number;
  method: PaymentMethod;
  reference?: string;
  note?: string;
  paidAt: string;
  recordedBy?: { name: string } | string;
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  customer?: { _id: string; name: string; email: string; phone?: string } | null;
  booking?: { _id: string; bookingNumber: string; status?: string } | null;
  sale?: { _id: string; billNumber: string } | null;
  customisationOrder?: { _id: string; billNumber: string } | null;
  source?: 'booking' | 'sale' | 'customisation' | 'manual';
  billTo?: { name: string; phone?: string; address?: string };
  lineItems: { description: string; quantity: number; unitPrice: number; amount: number }[];
  subtotal: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  securityDeposit: number;
  depositRefunded: boolean;
  total: number;
  amountPaid: number;
  amountDue: number;
  status: InvoiceStatus;
  payments: InvoicePayment[];
  dueDate: string;
  issuedAt?: string | null;
  notes?: string;
  bookingStage?: string;
  stageHistory?: { stage: string; at: string; total: number; amountPaid: number }[];
  deletedAt?: string | null;
  createdAt: string;
}

export interface Sale {
  _id: string;
  billNumber: string;
  saleDate: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customer?: string;
  product: { _id: string; name: string; images: string[]; sku: string } | null;
  details?: string;
  totalAmount: number;
  advancePayment: number;
  duePaid?: number;
  dueAmount: number;
  source: 'manual' | 'booking';
  invoiceId?: string | null;
  createdAt: string;
}

export type ServiceType = 'dry_clean' | 'tailor';
export type ServiceStatus = 'pending' | 'in_progress' | 'quality_check' | 'completed' | 'cancelled';

export interface ServiceOrder {
  _id: string;
  deletedAt?: string | null;
  serviceType: ServiceType;
  product: { _id: string; name: string; images: string[]; sku: string } | null;
  booking?: { _id: string; bookingNumber: string } | null;
  bookingBillNumberRef?: string;
  description: string;
  status: ServiceStatus;
  dryCleanCharge?: number;
  ironCharge?: number;
  stitchingCharge?: number;
  stitchingType?: string;
  otherCharge?: number;
  totalAmount: number;
  assignedTo?: string;
  sentDate: string;
  expectedReturnDate: string;
  completedDate?: string | null;
  notes?: string;
  createdAt: string;
}

export type CustomisationStatus = 'pending' | 'in_progress' | 'ready' | 'delivered' | 'cancelled';

export interface CustomisationOrder {
  _id: string;
  billNumber: string;
  orderDate: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  stitchingType: string;
  detail: string;
  measurements: Measurements;
  totalAmount: number;
  advancePayment: number;
  duePaid?: number;
  dueAmount: number;
  status: CustomisationStatus;
  notes?: string;
  createdAt: string;
}

export type ExpenseCategory =
  | 'rent'
  | 'electricity'
  | 'water'
  | 'maintenance'
  | 'transport'
  | 'marketing'
  | 'office_supplies'
  | 'miscellaneous';

export interface Expense {
  _id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  expenseDate: string;
  paymentMethod?: string;
  notes?: string;
  createdAt: string;
}

export interface Purchase {
  _id: string;
  billNumber?: string;
  itemName: string;
  vendorName: string;
  vendorContact?: string;
  product?: { _id: string; name: string; sku: string } | null;
  variantSize?: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  purchaseDate: string;
  paymentStatus: 'paid' | 'pending' | 'partial';
  amountPaid: number;
  addedToStock: boolean;
  notes?: string;
}

export interface StaffMember {
  _id: string;
  name: string;
  phone?: string;
  designation: string;
  monthlySalary: number;
  joiningDate: string;
  isActive: boolean;
  notes?: string;
}

export interface SalaryPayment {
  _id: string;
  staff: { _id: string; name: string; designation?: string } | null;
  amount: number;
  forMonth: string;
  paymentDate: string;
  paymentMethod: string;
  notes?: string;
}

export interface TeamUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface AppNotification {
  _id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export interface Review {
  _id: string;
  customerName: string;
  rating: number;
  comment?: string;
  images: string[];
  createdAt: string;
  booking: { _id: string; bookingNumber: string } | null;
}

export interface Enquiry {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  reason: string;
  message: string;
  isResolved: boolean;
  createdAt: string;
}

export interface DashboardStats {
  totalRevenue: number;
  totalBookings: number;
  activeRentals: number;
  totalCustomers: number;
  totalProducts: number;
  outstandingBalance: number;
  returnsDue: number;
  availableDresses: number;
  reservedDresses: number;
  todaysBookings: number;
  todaysPickups: number;
  todaysReturns: number;
  returnedToday: number;
  pendingPaymentsCount: number;
  overdueInvoicesCount: number;
  overdueInvoicesTotal: number;
  monthlyRevenueTotal: number;
  previousMonthRevenueTotal: number;
  lowStockCount: number;
  newCustomersThisMonth: number;
  newCustomersPreviousMonth: number;
  bookingsThisMonth: number;
  bookingsPreviousMonth: number;
  categoryBookingBreakdown: { category: string; bookings: number }[];
  recentBookings: {
    _id: string;
    bookingNumber: string;
    status: BookingStatus;
    totalAmount: number;
    createdAt: string;
    rentalStartDate: string;
    rentalEndDate: string;
    customer: { name: string } | null;
    productSummary: string;
  }[];
  monthlyRevenue: { label: string; revenue: number; bookings: number }[];
}

// ---- Customer-facing ------------------------------------------------------

export interface PremiumState {
  isActive: boolean;
  plan: string | null;
  expiresAt: string | null;
}

export interface ProductCard {
  _id: string;
  name: string;
  designer: string;
  category: { _id: string; name: string; slug: string } | null;
  rentalPricePerDay: number;
  securityDeposit: number;
  retailValue: number;
  color: string;
  fabric: string;
  images: string[];
  sizes: string[];
  isNewArrival: boolean;
  isFeatured: boolean;
  averageRating: number;
  reviewCount: number;
}

export interface ProductDetail extends ProductCard {
  description: string;
  dressType: string;
  work: string;
  tags: string[];
}

export interface CustomerHome {
  premium: PremiumState;
  lockedEarlyAccessCount: number;
  categories: { _id: string; name: string; slug: string; description: string; heroImage: string }[];
  featured: ProductCard[];
  newArrivals: ProductCard[];
  designers?: { name: string; productCount: number; image: string }[];
}

export interface Me {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  isEmailVerified: boolean;
  addresses: {
    label: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    isDefault: boolean;
  }[];
  wishlistCount: number;
  premium: PremiumState;
  memberSince: string;
}

export interface MyBooking {
  _id: string;
  bookingNumber: string;
  billNumber: string;
  status: BookingStatus;
  rentalStartDate: string;
  rentalEndDate: string;
  eventDate: string;
  totalAmount: number;
  securityDeposit: number;
  advancePaid: number;
  remainingDue: number;
  items: {
    productId: string | null;
    name: string;
    image: string;
    color: string;
    size: string;
    rentalFee: number;
    wearerName?: string;
  }[];
  damageCharges?: number;
  depositRefundAmount?: number;
  depositRefunded?: boolean;
  returnedAt?: string | null;
  reviewToken?: string | null;
}
