const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** ₹ with Indian digit grouping (1,23,456). Hermes Intl support varies, so this is done by hand. */
export function inr(value: number | null | undefined, opts: { decimals?: boolean } = {}): string {
  const n = Number(value ?? 0);
  const negative = n < 0;
  const abs = Math.abs(n);
  const fixed = opts.decimals ? abs.toFixed(2) : Math.round(abs).toString();
  const [whole, fraction] = fixed.split('.');
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
  return `${negative ? '−' : ''}₹${grouped}${fraction ? `.${fraction}` : ''}`;
}

/** Compact ₹ for tiles: ₹1.2L, ₹3.4Cr, ₹12.5K. */
export function inrCompact(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(abs >= 1e8 ? 0 : 1)}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(abs >= 1e6 ? 0 : 1)}L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}K`;
  return inr(n);
}

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function fmtDate(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  return date ? `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}` : '—';
}

export function fmtShortDate(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  return date ? `${date.getDate()} ${MONTHS[date.getMonth()]}` : '—';
}

export function fmtDateTime(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  const h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${fmtShortDate(date)}, ${((h + 11) % 12) + 1}:${m} ${h < 12 ? 'am' : 'pm'}`;
}

export function fmtRange(from?: string | null, to?: string | null): string {
  return `${fmtShortDate(from)} → ${fmtShortDate(to)}`;
}

export function relativeTime(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '';
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return fmtShortDate(date);
}

/** YYYY-MM-DD in local time — what the API's date fields expect. */
export function isoDay(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isoMonth(date: Date = new Date()): string {
  return isoDay(date).slice(0, 7);
}

export function initials(name?: string | null): string {
  if (!name) return '·';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function titleCase(value?: string | null): string {
  if (!value) return '';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function num(value: string): number | undefined {
  const cleaned = value.replace(/[^0-9.]/g, '');
  if (cleaned === '') return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}
