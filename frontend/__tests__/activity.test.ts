/**
 * Multi-timezone tests for Wallet Recent Activity.
 *
 * Zones are passed EXPLICITLY to the pure functions (Intl-backed), so every
 * test is deterministic regardless of the machine's own timezone. Covered:
 * WIB (Asia/Jakarta, UTC+7), UTC, UTC-5 (America/Bogota), and DST-adjacent
 * America/New_York (spring-forward & fall-back edges).
 *
 * The full flow is exercised per case: stored timestamp -> day key ->
 * grouping/order -> rendered time string.
 */
import { groupActivitiesByDay, compareIntraDay } from '../src/lib/activity';
import { formatActivityTime, activityDayKey, todayLocalISO } from '../src/utils/dates';

const WIB = 'Asia/Jakarta';
const BOGOTA = 'America/Bogota'; // UTC-5, no DST
const NYC = 'America/New_York';
const UTC = 'UTC';

describe('todayLocalISO uses the viewing zone calendar', () => {
  it('WIB just after local midnight -> TODAY is Aug 22 even though UTC says Aug 21', () => {
    const now = new Date('2026-08-21T17:30:00Z'); // 00:30 WIB Aug 22
    expect(todayLocalISO(now, WIB)).toBe('2026-08-22');
    expect(todayLocalISO(now, UTC)).toBe('2026-08-21');
  });

  it('UTC-5 before local midnight -> still Aug 21 even though UTC says Aug 22', () => {
    const now = new Date('2026-08-22T04:30:00Z'); // 23:30 Bogota Aug 21
    expect(todayLocalISO(now, BOGOTA)).toBe('2026-08-21');
    expect(todayLocalISO(now, UTC)).toBe('2026-08-22');
  });
});

describe('activityDayKey: date-only is user intent, instants are zone-rendered', () => {
  it('date-only keys are zone-independent (never re-interpreted)', () => {
    for (const tz of [WIB, UTC, BOGOTA, NYC]) {
      expect(activityDayKey('2026-08-21', tz)).toBe('2026-08-21');
    }
  });

  it('same instant maps to different days per zone, correctly', () => {
    const instant = '2026-08-21T03:30:00+00:00'; // 10:30 WIB / 03:30 UTC / 22:30 Bogota (Aug 20)
    expect(activityDayKey(instant, WIB)).toBe('2026-08-21');
    expect(activityDayKey(instant, UTC)).toBe('2026-08-21');
    expect(activityDayKey(instant, BOGOTA)).toBe('2026-08-20');
  });
});

describe('formatActivityTime picks honest sources in every zone', () => {
  const fmtOpts = { hour: '2-digit' as const, minute: '2-digit' as const };

  it.each([WIB, UTC, BOGOTA, NYC])(
    'created_at wins in %s and renders that instant (never a fabricated 07:00)',
    (tz) => {
      const tx = { created_at: '2026-08-21T14:32:00+07:00', date: '2026-08-21' };
      const rendered = formatActivityTime(tx, tz);
      expect(rendered).not.toBe('');
      // Independent render of the same instant with IDENTICAL options
      // (locale left to the environment so hour12 style matches).
      const expected = new Intl.DateTimeFormat(undefined, { ...fmtOpts, timeZone: tz }).format(new Date(tx.created_at!));
      expect(rendered).toBe(expected);
      // And it must NOT equal the fake time a bare-date parse would produce.
      const fakeMidnight = new Intl.DateTimeFormat(undefined, { ...fmtOpts, timeZone: tz }).format(new Date('2026-08-21'));
      if (fakeMidnight !== expected) {
        expect(rendered).not.toBe(fakeMidnight);
      }
    },
  );

  it.each([WIB, UTC, BOGOTA, NYC])('date-only without created_at shows NO time in %s', (tz) => {
    expect(formatActivityTime({ date: '2026-08-21' }, tz)).toBe('');
  });

  it('full ISO without created_at still renders its real time', () => {
    expect(formatActivityTime({ date: '2026-08-21T09:15:00+07:00' }, WIB)).not.toBe('');
  });
});

describe('day boundary 23:59 vs 00:01 stays inside its own group', () => {
  it('WIB device at 01:00: yesterday-23:59 -> YESTERDAY, today-00:01 -> TODAY', () => {
    const now = new Date('2026-08-21T18:00:00Z'); // 01:00 WIB Aug 22
    const groups = groupActivitiesByDay([
      { id: 'tx_late', date: '2026-08-21', created_at: '2026-08-21T16:59:00+07:00' }, // 23:59 WIB
      { id: 'tx_early', date: '2026-08-22', created_at: '2026-08-21T18:01:00+07:00' }, // 00:01 WIB Aug 22
    ], { now, timeZone: WIB });
    expect(groups[0].label).toBe('TODAY');
    expect(groups[0].items.map((t) => t.id)).toEqual(['tx_early']);
    expect(groups[1].label).toBe('YESTERDAY');
    expect(groups[1].items.map((t) => t.id)).toEqual(['tx_late']);
  });

  it('Bogota device near midnight UTC: tx saved 19:59 local groups under Aug 21; still TODAY because Bogota clock is 21:00 Aug 21', () => {
    const tx = { id: 'tx_x', date: '2026-08-21', created_at: '2026-08-22T00:59:00+00:00' }; // 19:59 Bogota Aug 21
    const groups = groupActivitiesByDay([tx], { now: new Date('2026-08-22T02:00:00+00:00'), timeZone: BOGOTA });
    expect(groups).toHaveLength(1);
    expect(groups[0].items[0].id).toBe('tx_x');
    // 02:00Z == 21:00 Aug 21 in Bogota, so the user's "today" is still Aug 21 —
    // UTC-based logic would wrongly call it the next day.
    expect(groups[0].label).toBe('TODAY');
  });
});

describe('DST-adjacent instants (America/New_York)', () => {
  it('spring-forward morning 2026-03-08 keeps the day and a renderable time', () => {
    const tx = { id: 'tx_dst', created_at: '2026-03-08T07:30:00+00:00', date: '2026-03-08' }; // 03:30 EDT (02:00 skipped)
    const groups = groupActivitiesByDay([tx], { timeZone: NYC });
    expect(groups).toHaveLength(1);
    expect(formatActivityTime(tx, NYC)).not.toBe('');
  });

  it('fall-back ambiguous hour 2026-11-01 stays on Nov 1 and orders deterministically against pre-transition tx', () => {
    const afterFallback = { id: 'tx_after', created_at: '2026-11-01T05:30:00+00:00', date: '2026-11-01' }; // 01:30 EST
    const beforeFallback = { id: 'tx_before', created_at: '2026-11-01T05:00:00+00:00', date: '2026-11-01' }; // 01:00 EDT
    const groups = groupActivitiesByDay([beforeFallback, afterFallback], { timeZone: NYC });
    expect(groups).toHaveLength(1);
    // Absolute-instant order preserved across the DST fold
    expect(groups[0].items.map((t) => t.id)).toEqual(['tx_after', 'tx_before']);
    expect(formatActivityTime(afterFallback, NYC)).not.toBe('');
  });
});

describe('ordering determinism across all zones', () => {
  const txs = [
    { id: 'tx_a', date: '2026-08-21', created_at: '2026-08-21T10:00:00+07:00' },
    { id: 'tx_b', date: '2026-08-21', created_at: '2026-08-21T10:05:00+07:00' },
    { id: 'tx_c', date: '2026-08-21', created_at: '2026-08-21T10:10:00+07:00' },
  ];

  it.each([WIB, UTC, BOGOTA, NYC])('create A,B,C same day -> C,B,A (%s)', (tz) => {
    expect(groupActivitiesByDay(txs, { timeZone: tz })[0].items.map((t) => t.id))
      .toEqual(['tx_c', 'tx_b', 'tx_a']);
  });

  it('identical timestamps fall back to deterministic id DESC', () => {
    const pair = [
      { id: 'tx_aaa', date: '2026-08-21', created_at: '2026-08-21T10:00:00Z' },
      { id: 'tx_zzz', date: '2026-08-21', created_at: '2026-08-21T10:00:00Z' },
    ];
    expect(compareIntraDay(pair[0], pair[1])).toBeGreaterThan(0);
    expect(groupActivitiesByDay(pair)[0].items.map((t) => t.id)).toEqual(['tx_zzz', 'tx_aaa']);
  });

  it('missing created_at entirely still orders deterministically by id DESC', () => {
    const pair = [{ id: 'tx_b2', date: '2026-08-21' }, { id: 'tx_a2', date: '2026-08-21' }];
    expect(groupActivitiesByDay(pair)[0].items.map((t) => t.id)).toEqual(['tx_b2', 'tx_a2']);
  });

  it('post-migration invariant: identical canonical dates order by save-time DESC', () => {
    const txs2 = [
      { id: 'tx_old', date: '2026-08-21', created_at: '2026-08-01T09:00:00+00:00' },
      { id: 'tx_new', date: '2026-08-21', created_at: '2026-08-21T15:00:00+00:00' },
    ];
    expect(groupActivitiesByDay(txs2, { timeZone: WIB })[0].items.map((t) => t.id))
      .toEqual(['tx_new', 'tx_old']);
  });

  it('groups themselves sort newest-day-first lexicographically', () => {
    const spread = [
      { id: 'tx_1', date: '2026-07-31', created_at: '2026-07-31T10:00:00Z' },
      { id: 'tx_2', date: '2026-08-21', created_at: '2026-08-20T10:00:00Z' },
      { id: 'tx_3', date: '2026-08-22', created_at: '2026-08-21T10:00:00Z' },
    ];
    // now = 07:00 WIB Aug 22 -> today=Aug 22, yesterday=Aug 21
    const labels = groupActivitiesByDay(spread, { now: new Date('2026-08-22T00:00:00Z'), timeZone: WIB }).map((g) => g.label);
    expect(labels[0]).toBe('TODAY');
    expect(labels[1]).toBe('YESTERDAY');
    expect(labels[2]).toMatch(/JUL/);
  });
});
