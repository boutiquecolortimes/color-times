import {
  bookingDepositHeld,
  bookingDepositState,
  bookingPaidBreakdown,
  bookingRemainingDue,
} from '../src/lib/bookingMoney';

// rent 3000 + deposit 2000
const base = { totalAmount: 5000, securityDeposit: 2000 };

describe('booking money (parity with web lib/admin/booking-status)', () => {
  it('only unpaid rent is due before return', () => {
    expect(bookingRemainingDue({ ...base, status: 'confirmed', advancePaid: 1000 })).toBe(2000);
    expect(bookingRemainingDue({ ...base, status: 'in_use', advancePaid: 5000 })).toBe(0);
  });

  it('after return, unpaid rent + damage comes out of the deposit first', () => {
    const b = { ...base, status: 'returned', advancePaid: 2000, damageCharges: 500, depositRefundAmount: 0 };
    // rent 3000 + damage 500 - paid 2000 - deposit used 2000 = 0 (floored)
    expect(bookingRemainingDue(b)).toBe(0);
    expect(bookingDepositState(b)).toBe('kept');
  });

  it('deposit held is what was paid beyond rent, capped at the deposit', () => {
    expect(bookingDepositHeld({ ...base, status: 'in_use', advancePaid: 4000 })).toBe(1000);
    expect(bookingDepositHeld({ ...base, status: 'in_use', advancePaid: 9000 })).toBe(2000);
    expect(bookingDepositState({ ...base, status: 'confirmed', advancePaid: 1000 })).toBe('not_collected');
  });

  it('refund states', () => {
    const r = { ...base, status: 'returned', advancePaid: 5000, depositRefundAmount: 2000 };
    expect(bookingDepositState(r)).toBe('refund_pending');
    expect(bookingDepositHeld(r)).toBe(2000);
    expect(bookingDepositState({ ...r, depositRefunded: true })).toBe('refunded');
    expect(bookingDepositHeld({ ...r, depositRefunded: true })).toBe(0);
  });

  it('splits payments rent-first', () => {
    expect(bookingPaidBreakdown({ ...base, advancePaid: 5000, pickupPaid: 4000 })).toEqual({
      advance: 1000,
      duePaid: 2000,
      securityHeld: 2000,
    });
  });
});
