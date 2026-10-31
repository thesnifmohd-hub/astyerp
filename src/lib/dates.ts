/**
 * Asty ERP — Date, Timezone (Asia/Kolkata) & Indian Financial Year (April–March) Utilities
 * Display format: DD-MM-YYYY
 */

export const ASTY_TIMEZONE = 'Asia/Kolkata';

export function todayISOInIST(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ASTY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

export function formatDDMMYYYY(isoOrDate?: string | Date | null): string {
  if (!isoOrDate) return '—';
  if (typeof isoOrDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) {
    const [y, m, d] = isoOrDate.split('-');
    return `${d}-${m}-${y}`;
  }
  const dt = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(dt.getTime())) return String(isoOrDate);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ASTY_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(dt);
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const y = parts.find((p) => p.type === 'year')?.value ?? '2026';
  return `${d}-${m}-${y}`;
}

export function formatDateTimeIST(isoOrDate?: string | Date | null): string {
  if (!isoOrDate) return '—';
  const dt = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(dt.getTime())) return String(isoOrDate);
  const datePart = formatDDMMYYYY(dt);
  const timePart = new Intl.DateTimeFormat('en-IN', {
    timeZone: ASTY_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(dt);
  return `${datePart}, ${timePart.toUpperCase()} IST`;
}

/**
 * Indian Financial Year (1 April – 31 March), e.g. '2026-27'
 */
export function getFinancialYear(isoDate: string = todayISOInIST()): string {
  const [yStr, mStr] = isoDate.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const startYear = month >= 4 ? year : year - 1;
  const endShort = ((startYear + 1) % 100).toString().padStart(2, '0');
  return `${startYear}-${endShort}`;
}

export function isTimeWithinWindow(hhmmNow: string, startHHMM: string, endHHMM: string): boolean {
  return hhmmNow >= startHHMM && hhmmNow <= endHHMM;
}

export function currentHHMMInIST(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ASTY_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const h = parts.find((p) => p.type === 'hour')?.value ?? '09';
  const m = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${h}:${m}`;
}

