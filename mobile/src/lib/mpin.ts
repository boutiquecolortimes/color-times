import * as Keychain from 'react-native-keychain';
import { sha256 } from './sha256';
import { prefs } from './storage';

/**
 * MPIN: a 4-digit quick unlock that never leaves the phone. Only a salted
 * hash is kept, in the iOS Keychain / Android Keystore (this device only),
 * together with the wrong-attempt count so closing the app doesn't reset it.
 * After MAX_ATTEMPTS wrong PINs the caller signs out and the MPIN is removed.
 */
const MPIN_SERVICE = 'com.colortimes.boutique.mpin';
export const MPIN_LENGTH = 4;
export const MAX_ATTEMPTS = 5;
const ROUNDS = 2000;

interface Record {
  salt: string;
  hash: string;
  failed: number;
}

function digest(pin: string, salt: string): string {
  let h = sha256(`${salt}:${pin}`);
  for (let i = 1; i < ROUNDS; i++) h = sha256(h + salt);
  return h;
}

function randomSalt(): string {
  let s = '';
  for (let i = 0; i < 4; i++)
    s += Math.floor(Math.random() * 0x100000000)
      .toString(16)
      .padStart(8, '0');
  return s + Date.now().toString(16);
}

async function read(): Promise<Record | null> {
  try {
    const r = await Keychain.getGenericPassword({ service: MPIN_SERVICE });
    if (!r) return null;
    const parsed = JSON.parse(r.password) as Partial<Record>;
    return parsed.salt && parsed.hash
      ? { salt: parsed.salt, hash: parsed.hash, failed: parsed.failed ?? 0 }
      : null;
  } catch {
    return null;
  }
}

async function write(rec: Record): Promise<void> {
  await Keychain.setGenericPassword('mpin', JSON.stringify(rec), {
    service: MPIN_SERVICE,
    accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}

/** PINs that are too easy to guess: all one digit, or a straight run up or down. */
export function weakPin(pin: string): boolean {
  if (/^(\d)\1+$/.test(pin)) return true;
  const d = Array.from(pin, Number);
  const up = d.every((x, i) => i === 0 || x === (d[i - 1] + 1) % 10);
  const down = d.every((x, i) => i === 0 || x === (d[i - 1] + 9) % 10);
  return up || down;
}

export async function hasMpin(): Promise<boolean> {
  return (await prefs.get('mpinLock')) === '1';
}

export async function setMpin(pin: string): Promise<void> {
  if (!new RegExp(`^\\d{${MPIN_LENGTH}}$`).test(pin)) throw new Error(`MPIN must be ${MPIN_LENGTH} digits`);
  const salt = randomSalt();
  await write({ salt, hash: digest(pin, salt), failed: 0 });
  await prefs.set('mpinLock', '1');
}

export async function clearMpin(): Promise<void> {
  try {
    await Keychain.resetGenericPassword({ service: MPIN_SERVICE });
  } catch {
    // nothing stored
  }
  await prefs.remove('mpinLock');
}

export type MpinCheck = { ok: true } | { ok: false; attemptsLeft: number };

/** Checks a PIN; counts wrong tries across app restarts. attemptsLeft 0 = locked out. */
export async function verifyMpin(pin: string): Promise<MpinCheck> {
  const rec = await read();
  if (!rec) return { ok: false, attemptsLeft: 0 };
  if (digest(pin, rec.salt) === rec.hash) {
    if (rec.failed) await write({ ...rec, failed: 0 });
    return { ok: true };
  }
  const failed = rec.failed + 1;
  await write({ ...rec, failed });
  return { ok: false, attemptsLeft: Math.max(0, MAX_ATTEMPTS - failed) };
}
