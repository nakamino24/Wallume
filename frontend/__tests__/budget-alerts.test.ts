import { evaluateBudgetAlerts, checkBudgetAlerts } from '@/src/utils/notifications';
import * as Notifications from 'expo-notifications';

// storage is a real class instance on a real AsyncStorage backing store;
// replace it so alert state can be asserted directly.
jest.mock('@/src/utils/storage', () => ({
  storage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

const { storage } = require('@/src/utils/storage');

const t = (key: string, params?: Record<string, string | number>) => {
  const text = ({
    'notif.budget.near.title': 'Budget almost used',
    'notif.budget.near.body': '{category}: {spent} of {amount} spent.',
    'notif.budget.over.title': 'Budget exceeded',
    'notif.budget.over.body': '{category}: {spent} spent against a {amount} budget.',
  } as Record<string, string>)[key] || key;
  return params
    ? text.replace(/\{(\w+)\}/g, (_m, k) => String(params[k] ?? `{${k}}`))
    : text;
};

const formatMoney = (n: number) => `Rp${n}`;
const settings = { billingReminder: true, budgetAlert: true, paydayReminder: true };

beforeEach(() => {
  jest.clearAllMocks();
  (storage.getItem as jest.Mock).mockImplementation(() => Promise.resolve('{}'));
  (storage.setItem as jest.Mock).mockImplementation(() => Promise.resolve(true));
});

/** The alert map is persisted as a JSON string (storage only accepts scalars). */
function persistedMap(): Record<string, string> {
  const call = (storage.setItem as jest.Mock).mock.calls.at(-1);
  return call ? JSON.parse(call[1]) : {};
}

function primeStorage(map: Record<string, string>) {
  (storage.getItem as jest.Mock).mockImplementation(() => Promise.resolve(JSON.stringify(map)));
}

describe('evaluateBudgetAlerts', () => {
  it('reports nothing below 80%', () => {
    expect(evaluateBudgetAlerts([{ id: 'b1', category: 'Food', spent: 79, amount: 100 }])).toEqual([]);
  });

  it('reports the 80% threshold at exactly 80%', () => {
    const [alert] = evaluateBudgetAlerts([{ id: 'b1', category: 'Food', spent: 80, amount: 100 }]);
    expect(alert.threshold).toBe(80);
  });

  it('reports 100% rather than 80% when over budget', () => {
    const alerts = evaluateBudgetAlerts([{ id: 'b1', category: 'Food', spent: 150, amount: 100 }]);
    // One alert per budget, at the highest threshold crossed.
    expect(alerts).toHaveLength(1);
    expect(alerts[0].threshold).toBe(100);
  });

  it('ignores zero-value budgets', () => {
    expect(evaluateBudgetAlerts([{ id: 'b1', category: 'Food', spent: 50, amount: 0 }])).toEqual([]);
  });

  it('handles multiple budgets independently', () => {
    const alerts = evaluateBudgetAlerts([
      { id: 'b1', category: 'Food', spent: 90, amount: 100 },
      { id: 'b2', category: 'Transport', spent: 10, amount: 100 },
      { id: 'b3', category: 'Bills', spent: 200, amount: 100 },
    ]);
    expect(alerts.map((a) => a.budgetId)).toEqual(['b1', 'b3']);
  });
});

describe('checkBudgetAlerts', () => {
  it('does nothing when the toggle is off', async () => {
    const fired = await checkBudgetAlerts({
      budgets: [{ id: 'b1', category: 'Food', spent: 200, amount: 100 }],
      settings: { ...settings, budgetAlert: false },
      t,
      formatMoney,
    });
    expect(fired).toEqual([]);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('fires a local notification when a budget crosses a threshold', async () => {
    const fired = await checkBudgetAlerts({
      budgets: [{ id: 'b1', category: 'Food', spent: 85, amount: 100 }],
      settings, t, formatMoney,
    });
    expect(fired).toHaveLength(1);
    expect(fired[0].threshold).toBe(80);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('uses the over-budget copy when spending exceeds the limit', async () => {
    await checkBudgetAlerts({
      budgets: [{ id: 'b1', category: 'Food', spent: 120, amount: 100 }],
      settings, t, formatMoney,
    });
    const args = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
    expect(args.content.title).toBe('Budget exceeded');
    expect(args.content.body).toContain('Food');
  });

  it('does not re-fire the same threshold on the next check', async () => {
    const budgets = [{ id: 'b1', category: 'Food', spent: 85, amount: 100 }];
    const first = await checkBudgetAlerts({ budgets, settings, t, formatMoney, periodKey: '2026-08' });
    expect(first).toHaveLength(1);

    primeStorage(persistedMap());
    const second = await checkBudgetAlerts({ budgets, settings, t, formatMoney, periodKey: '2026-08' });
    expect(second).toHaveLength(0);
  });

  it('re-arms once the period rolls over', async () => {
    const budgets = [{ id: 'b1', category: 'Food', spent: 85, amount: 100 }];
    await checkBudgetAlerts({ budgets, settings, t, formatMoney, periodKey: '2026-08' });
    primeStorage(persistedMap());

    const nextPeriod = await checkBudgetAlerts({ budgets, settings, t, formatMoney, periodKey: '2026-09' });
    expect(nextPeriod).toHaveLength(1);
  });

  it('escalates from 80% to 100% for the same budget', async () => {
    await checkBudgetAlerts({
      budgets: [{ id: 'b1', category: 'Food', spent: 85, amount: 100 }],
      settings, t, formatMoney, periodKey: '2026-08',
    });
    primeStorage(persistedMap());

    const escalated = await checkBudgetAlerts({
      budgets: [{ id: 'b1', category: 'Food', spent: 130, amount: 100 }],
      settings, t, formatMoney, periodKey: '2026-08',
    });
    expect(escalated).toHaveLength(1);
    expect(escalated[0].threshold).toBe(100);
  });

  it('drops state for budgets that no longer exist', async () => {
    primeStorage({ 'deleted:100': '2026-08', 'b1:80': '2026-08' });
    await checkBudgetAlerts({
      budgets: [{ id: 'b1', category: 'Food', spent: 10, amount: 100 }],
      settings, t, formatMoney, periodKey: '2026-08',
    });
    const written = persistedMap();
    expect(Object.keys(written).every((k) => k.startsWith('b1'))).toBe(true);
  });

  it('never throws when notifications are unavailable', async () => {
    (Notifications.scheduleNotificationAsync as jest.Mock).mockImplementationOnce(() => {
      throw new Error('no permission');
    });
    const fired = await checkBudgetAlerts({
      budgets: [{ id: 'b1', category: 'Food', spent: 200, amount: 100 }],
      settings, t, formatMoney,
    });
    // Still surfaced in-app, but not marked delivered so it can retry later.
    expect(fired).toHaveLength(1);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
