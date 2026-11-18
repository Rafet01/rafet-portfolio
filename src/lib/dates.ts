/** English date formatting for nullable "YYYY-MM" / "YYYY" values. */
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

type Status = 'completed' | 'current' | 'upcoming';

export function formatPartialDate(value: string | null, style: 'short' | 'long' = 'short'): string | null {
  if (!value) return null;
  const [year, month] = value.split('-');
  if (!month) return year ?? null;
  const name = MONTHS[Number(month) - 1];
  if (!name) return null;
  return `${style === 'short' ? name.slice(0, 3) : name} ${year}`;
}

/** e.g. "Starting February 2027", "Sep 2024 – Jun 2025", "2025 – present". Null when nothing is confirmed. */
export function formatRange(start: string | null, end: string | null, status: Status): string | null {
  if (status === 'upcoming') {
    const s = formatPartialDate(start, 'long');
    return s ? `Starting ${s}` : 'Upcoming';
  }
  const s = formatPartialDate(start);
  const e = formatPartialDate(end);
  if (status === 'current') return s ? `${s} – present` : null;
  if (s && e) return s === e ? s : `${s} – ${e}`;
  return s ?? e;
}

/** Machine-readable value for <time datetime>. */
export function isoPartial(value: string | null): string | undefined {
  return value ?? undefined;
}
