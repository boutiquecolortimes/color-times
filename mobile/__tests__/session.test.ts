import { IDLE_SIGNOUT_MS, idleExpired } from '../src/lib/session';

describe('8-hour idle sign-out (same rule as the web admin)', () => {
  const now = 1_800_000_000_000;
  it('signs staff and admins out after 8 hours idle', () => {
    for (const role of ['staff', 'admin', 'developer', 'super_admin'] as const) {
      expect(idleExpired(role, now - IDLE_SIGNOUT_MS - 1, now)).toBe(true);
      expect(idleExpired(role, now - IDLE_SIGNOUT_MS + 60_000, now)).toBe(false);
    }
  });
  it('never signs customers out for idleness', () => {
    expect(idleExpired('customer', now - 30 * IDLE_SIGNOUT_MS, now)).toBe(false);
  });
  it('ignores a missing last-active time', () => {
    expect(idleExpired('admin', null, now)).toBe(false);
  });
});
