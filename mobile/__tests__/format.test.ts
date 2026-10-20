import { inr, inrCompact, isoDay, titleCase } from '../src/lib/format';

describe('format', () => {
  it('formats rupees with Indian grouping', () => {
    expect(inr(1234567)).toBe('₹12,34,567');
    expect(inr(999)).toBe('₹999');
    expect(inr(-2500)).toBe('−₹2,500');
  });
  it('compacts large amounts', () => {
    expect(inrCompact(150000)).toBe('₹1.5L');
    expect(inrCompact(25000000)).toBe('₹2.5Cr');
    expect(inrCompact(12500)).toBe('₹13K');
  });
  it('builds local ISO days', () => {
    expect(isoDay(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
  it('title-cases enum values', () => {
    expect(titleCase('bank_transfer')).toBe('Bank Transfer');
  });
});
