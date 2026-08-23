// Local-calendar date helpers for transaction timestamps.
//
// Canonical stored form is "YYYY-MM-DD" (user-selected calendar day, no time).
// All functions accept an optional IANA `timeZone` used ONLY for rendering
// instants (full-ISO timestamps) into that zone's calendar/clock; omitted =
// the device's own zone, exactly like native Date local methods. Passing an
// explicit zone makes behavior deterministic and unit-testable anywhere.

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" for an instant as seen from `timeZone` (device zone if unset). */
export function ymdInZone(instant: Date, timeZone?: string): string {
  if (!timeZone) {
    const y = instant.getFullYear();
    const m = String(instant.getMonth() + 1).padStart(2, '0');
    const d = String(instant.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  // en-CA formats as YYYY-MM-DD natively
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function todayLocalISO(now: Date = new Date(), timeZone?: string): string {
  return ymdInZone(now, timeZone);
}

/**
 * Resolve a stored transaction timestamp to its user-facing calendar day key
 * ("YYYY-MM-DD").
 * - date-only values ARE the user's chosen day — returned verbatim, never
 *   re-interpreted through any zone (a bare parse would shift them to UTC
 *   midnight and fake "07:00" times / wrong days on offset devices).
 * - full-ISO instants map to the calendar day they fall on in `timeZone`.
 */
export function activityDayKey(raw?: string | null, timeZone?: string): string | null {
  if (!raw) return null;
  if (DATE_ONLY.test(raw)) return raw;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : ymdInZone(d, timeZone);
}
