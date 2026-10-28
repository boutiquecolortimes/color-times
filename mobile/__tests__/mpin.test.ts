import { sha256 } from '../src/lib/sha256';
import { MAX_ATTEMPTS, clearMpin, hasMpin, setMpin, verifyMpin, weakPin } from '../src/lib/mpin';

// In-memory Keychain + prefs.
const vault: Record<string, string> = {};
jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'x' },
  setGenericPassword: jest.fn(async (_u: string, p: string, o: { service: string }) => {
    vault[o.service] = p;
    return true;
  }),
  getGenericPassword: jest.fn(async (o: { service: string }) =>
    vault[o.service] ? { username: 'mpin', password: vault[o.service] } : false
  ),
  resetGenericPassword: jest.fn(async (o: { service: string }) => {
    delete vault[o.service];
    return true;
  }),
}));
const store: Record<string, string> = {};
jest.mock('../src/lib/storage', () => ({
  prefs: {
    get: jest.fn(async (k: string) => store[k] ?? null),
    set: jest.fn(async (k: string, v: string) => {
      store[k] = v;
    }),
    remove: jest.fn(async (k: string) => {
      delete store[k];
    }),
  },
}));

describe('sha256', () => {
  it('matches the FIPS 180-2 test vectors', () => {
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'
    );
    expect(sha256('a'.repeat(1000))).toBe('41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3');
  });
  it('handles non-ASCII text', () => {
    expect(sha256('₹')).toBe(require('crypto').createHash('sha256').update('₹').digest('hex'));
    expect(sha256('Wear the Moment ✨')).toBe(
      require('crypto').createHash('sha256').update('Wear the Moment ✨').digest('hex')
    );
    expect(sha256('कलर')).toHaveLength(64);
  });
});

describe('MPIN', () => {
  beforeEach(async () => {
    await clearMpin();
  });

  it('rejects easy-to-guess PINs', () => {
    for (const p of ['1111', '0000', '1234', '4321', '7890', '9012', '3210']) expect(weakPin(p)).toBe(true);
    for (const p of ['1357', '2580', '1122', '9174']) expect(weakPin(p)).toBe(false);
  });

  it('stores only a salted hash, and verifies the right PIN', async () => {
    await setMpin('2580');
    expect(await hasMpin()).toBe(true);
    const saved = Object.values(vault).join('');
    expect(saved).not.toContain('2580');
    expect(await verifyMpin('2580')).toEqual({ ok: true });
  });

  it('counts wrong attempts across checks and locks out at the limit', async () => {
    await setMpin('2580');
    for (let left = MAX_ATTEMPTS - 1; left >= 0; left--) {
      expect(await verifyMpin('9999')).toEqual({ ok: false, attemptsLeft: left });
    }
  });

  it('a correct PIN resets the wrong-attempt count', async () => {
    await setMpin('2580');
    await verifyMpin('1111');
    await verifyMpin('1111');
    expect(await verifyMpin('2580')).toEqual({ ok: true });
    expect(await verifyMpin('1111')).toEqual({ ok: false, attemptsLeft: MAX_ATTEMPTS - 1 });
  });

  it('removing the MPIN turns it off', async () => {
    await setMpin('2580');
    await clearMpin();
    expect(await hasMpin()).toBe(false);
    expect(await verifyMpin('2580')).toEqual({ ok: false, attemptsLeft: 0 });
  });

  it('refuses anything but 4 digits', async () => {
    await expect(setMpin('12a4')).rejects.toThrow();
    await expect(setMpin('123')).rejects.toThrow();
  });
});
