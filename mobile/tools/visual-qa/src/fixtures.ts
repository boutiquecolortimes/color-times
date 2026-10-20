/* Representative boutique data (long names, large ₹ amounts, missing fields) for visual QA. */
const img = (n: number) => `${location.origin}/img/dress${n}.jpg`;
const d = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString();

const customer = { _id: 'c1', name: 'Priyanka Raghunathan-Iyer', email: 'priyanka.iyer@example.com', phone: '9876543210' };

const booking = {
  _id: 'b1', bookingNumber: 'CT-2026-00881', billNumber: '00881', bookingDate: d(-6), customer,
  items: [
    { product: { _id: 'p1', name: 'Mehendi Green Anarkali with Zari Dupatta', images: [img(2)], sku: 'CT-0142' }, color: 'Emerald', size: 'M', quantity: 1, pricePerDay: 6500, rentalFee: 6500, wearerName: 'Priyanka', measurements: { bust: '34', waist: '28', hip: '38', shoulder: '14', sleeveLength: '18' } },
    { product: { _id: 'p2', name: 'Maroon Bridal Lehenga', images: [img(1)], sku: 'CT-0088' }, color: 'Maroon', size: 'S', quantity: 1, pricePerDay: 18500, rentalFee: 18500, wearerName: 'Ananya' },
  ],
  rentalStartDate: d(2), rentalEndDate: d(5), eventDate: d(3), status: 'confirmed', securityDeposit: 10000, totalAmount: 35000,
  advancePaid: 12000, pickupPaid: 0, advancePaymentMethod: 'UPI', createdAt: d(-6), reviewRequestedAt: null,
};
const booking2 = { ...booking, _id: 'b2', bookingNumber: 'CT-2026-00702', billNumber: '00702', bookingDate: d(-60), rentalStartDate: d(-55), rentalEndDate: d(-52), status: 'returned', advancePaid: 25000, depositRefundAmount: 10000, depositRefunded: true, depositRefundedAt: d(-51),
  items: [{ ...booking.items[0], measurements: { bust: '33', waist: '27', hip: '38', shoulder: '14', sleeveLength: '17' } }] };
const booking3 = { ...booking, _id: 'b3', bookingNumber: 'CT-2026-00890', billNumber: '00890', status: 'in_use', rentalStartDate: d(-1), rentalEndDate: d(1), advancePaid: 35000,
  customer: { _id: 'c2', name: 'Meera Kapoor', email: 'meera@example.com' }, items: [booking.items[1]] };

const months = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];

const card = (i: number, name: string, price: number, extra: object = {}) => ({
  _id: `p${i}`, name, designer: 'Atelier Rao', category: { _id: 'k1', name: 'Bridal', slug: 'bridal' },
  rentalPricePerDay: price, securityDeposit: 10000, retailValue: price * 12, color: 'Emerald', fabric: 'Raw silk',
  images: [img(((i - 1) % 3) + 1), img((i % 3) + 1)], sizes: ['S', 'M', 'L'], isNewArrival: i % 2 === 0, isFeatured: true,
  averageRating: 4.8, reviewCount: 23, ...extra,
});
const cards = [card(1, 'Maroon Bridal Lehenga', 18500), card(2, 'Mehendi Green Anarkali', 6500), card(3, 'Midnight Sequin Gown', 9200), card(4, 'Ivory Chikankari Saree', 5400)];

export function fixture(path: string, q: Record<string, unknown>): unknown {
  if (path === '/api/mobile/content') return {
    brand: { name: 'Color Times Boutique', nameHi: '', shortName: 'Color Times', tagline: 'Couture for every celebration', description: '', url: '' },
    contact: { phone: '+91 98290 12345', whatsapp: '919829012345', email: 'hello@colortimes.in', address: 'Ratanada, Jodhpur', addressHi: '', hours: '11am – 8pm', intro: '' },
    social: { instagram: '', facebook: '', pinterest: '' },
    stats: [{ label: 'Happy brides', value: 2400, suffix: '+', decimals: 0 }, { label: 'Designer pieces', value: 210, suffix: '+', decimals: 0 }, { label: 'Rating', value: 4.9, suffix: '', decimals: 1 }],
    whyChooseUs: [{ title: 'Fitted to you', description: 'Free alterations on every rental.', icon: 'Ruler' }, { title: 'Spotless care', description: 'Dry-cleaned and steamed before every handover.', icon: 'Sparkles' }],
    rentalProcess: [{ step: '01', title: 'Choose', description: 'Browse and request a dress.' }, { step: '02', title: 'Fit', description: 'Trial and alterations at the boutique.' }, { step: '03', title: 'Celebrate', description: 'Wear it, return it — we clean it.' }],
    testimonials: [{ name: 'Ritika S.', role: 'Bride, 2026', rating: 5, quote: 'The lehenga fitted like it was made for me.', avatar: '' }],
    testimonialSummary: '4.9 from 300+ reviews', faqs: [{ question: 'How early should I book?', answer: 'Two to four weeks before your event.' }],
    offers: [], offersNote: '', about: { kicker: '', title: '', image: '', paragraphs: [] }, blog: [], terms: [], privacy: [],
  };
  if (path === '/api/mobile/home') return {
    premium: { isActive: false, plan: null, expiresAt: null }, lockedEarlyAccessCount: 4,
    categories: [
      { _id: 'k1', name: 'Bridal', slug: 'bridal', description: 'Heirloom lehengas for the big day.', heroImage: img(1) },
      { _id: 'k2', name: 'Mehendi', slug: 'mehendi', description: '', heroImage: img(2) },
      { _id: 'k3', name: 'Cocktail', slug: 'cocktail', description: '', heroImage: img(3) },
    ],
    featured: cards, newArrivals: [...cards].reverse(), designers: [{ name: 'Atelier Rao', productCount: 14, image: img(2) }],
  };
  if (path.startsWith('/api/mobile/products/')) return {
    product: { ...card(2, 'Mehendi Green Anarkali with Hand-embroidered Zari Dupatta', 6500), description: 'Floor-length anarkali in raw silk with a hand-embroidered zari dupatta. Altered to fit at no extra cost.', dressType: 'Ready to wear', work: 'Zari, mirror', tags: [] },
    isWishlisted: false, related: cards.slice(0, 3), availability: [],
  };
  if (path === '/api/mobile/products') return { products: cards, pagination: { page: 1, pageSize: 20, total: 4, totalPages: 1 } };
  if (path === '/api/admin/dashboard') {
    return {
      totalRevenue: 4825000, totalBookings: 612, activeRentals: 9, totalCustomers: 1480, totalProducts: 214,
      outstandingBalance: 186500, returnsDue: 2, availableDresses: 171, reservedDresses: 34, todaysBookings: 4,
      todaysPickups: 3, todaysReturns: 2, returnedToday: 1, pendingPaymentsCount: 6, overdueInvoicesCount: 3,
      overdueInvoicesTotal: 64200, monthlyRevenueTotal: 512400, previousMonthRevenueTotal: 468900, lowStockCount: 5,
      newCustomersThisMonth: 38, newCustomersPreviousMonth: 31, bookingsThisMonth: 57, bookingsPreviousMonth: 49,
      categoryBookingBreakdown: [{ category: 'Bridal Lehengas', bookings: 21 }, { category: 'Gowns', bookings: 14 }, { category: 'Anarkalis', bookings: 12 }, { category: 'Sarees', bookings: 7 }],
      recentBookings: [booking, booking3].map((b) => ({ _id: b._id, bookingNumber: b.bookingNumber, status: b.status, totalAmount: b.totalAmount, createdAt: b.createdAt, rentalStartDate: b.rentalStartDate, rentalEndDate: b.rentalEndDate, customer: b.customer, productSummary: b.items.map((i) => i.product.name).join(', ') })),
      monthlyRevenue: months.map((m, i) => ({ label: `${m} 2026`, revenue: 280000 + ((i * 53731) % 260000), bookings: 30 + (i % 7) * 4 })),
    };
  }
  if (path === '/api/admin/notifications') return { notifications: [], unreadCount: 3 };
  if (path === '/api/admin/reports') {
    const k = q.range === 'today' ? 0.04 : q.range === 'week' ? 0.24 : 1;
    if (q.type === 'bookings') return { summary: { totalBookings: Math.round(57 * k), totalRevenue: Math.round(512400 * k) }, items: [] };
    if (q.type === 'invoices') return { summary: { totalCollected: Math.round(431800 * k), totalOutstanding: Math.round(186500 * Math.max(k, 0.3)) }, items: [] };
    if (q.type === 'profit-loss') return { summary: { totalRevenue: Math.round(598000 * k), totalCosts: Math.round(241300 * k), netProfit: Math.round(356700 * k), profitMargin: 59.6 }, items: [] };
  }
  if (path === '/api/admin/bookings/b1') return { booking, review: null };
  if (path === '/api/admin/bookings') {
    return { bookings: [booking, booking3, booking2], statusCounts: { all: 3, confirmed: 1, in_use: 1, returned: 1 }, summary: { totalRent: 75000, advanceCollected: 72000, dueAmount: 13000 }, pagination: { page: 1, pageSize: 20, total: 3, totalPages: 1 } };
  }
  if (path === '/api/admin/customers/c1') return { customer: { ...customer, fatherName: 'S/O Raghunathan Iyer', createdAt: d(-400), addresses: [{ label: 'Home', line1: '12, Shanti Kunj, Ratanada', city: 'Jodhpur', state: 'Rajasthan', postalCode: '342001', isDefault: true }] }, bookings: [booking, booking2] };
  if (path === '/api/admin/audit-log') return { logs: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 } };
  if (path === '/api/mobile/me') return { me: { id: 'u1', name: 'Ashok Verma', email: 'owner@colortimes.in', phone: '9829012345', role: 'super_admin', isEmailVerified: true, addresses: [], premium: { isActive: false, plan: null, expiresAt: null }, createdAt: d(-900) } };
  return {};
}
