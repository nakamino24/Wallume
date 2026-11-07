import * as Notifications from 'expo-notifications';
import { storage } from '@/src/utils/storage';

const KEYS = {
  billingReminder: 'mf.notif.billingReminder',
  budgetAlert: 'mf.notif.budgetAlert',
  paydayReminder: 'mf.notif.paydayReminder',
};

// Notifications fire at 9am local on the day something is due — not "10
// seconds from now", which is what the previous stub did and why every
// reminder arrived immediately instead of on the due date.
const REMINDER_HOUR = 9;

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // No notification runtime (e.g. web/test): scheduling is a no-op.
}

export type NotifSettings = {
  billingReminder: boolean;
  budgetAlert: boolean;
  paydayReminder: boolean;
};

export async function getNotifSettings(): Promise<NotifSettings> {
  const [billingReminder, budgetAlert, paydayReminder] = await Promise.all([
    storage.getItem<boolean>(KEYS.billingReminder, true),
    storage.getItem<boolean>(KEYS.budgetAlert, true),
    storage.getItem<boolean>(KEYS.paydayReminder, true),
  ]);
  return { billingReminder: billingReminder ?? true, budgetAlert: budgetAlert ?? true, paydayReminder: paydayReminder ?? true };
}

export async function setNotifSettings(settings: Partial<NotifSettings>): Promise<void> {
  const ops: Promise<any>[] = [];
  if (settings.billingReminder !== undefined) ops.push(storage.setItem(KEYS.billingReminder, settings.billingReminder));
  if (settings.budgetAlert !== undefined) ops.push(storage.setItem(KEYS.budgetAlert, settings.budgetAlert));
  if (settings.paydayReminder !== undefined) ops.push(storage.setItem(KEYS.paydayReminder, settings.paydayReminder));
  await Promise.all(ops);
}

/** Ask once for permission. Returns false when unavailable or denied. */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (current.status === 'denied') return false;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

/** Local 9am on the given YYYY-MM-DD (or ISO) date. */
function reminderTime(value: string | Date): Date | null {
  const date = value instanceof Date
    ? new Date(value.getTime())
    : /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T00:00:00`)
      : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(REMINDER_HOUR, 0, 0, 0);
  return date;
}

async function scheduleAt(when: Date, title: string, body: string, data: Record<string, any>) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
  });
}

export type BillReminder = {
  id: string;
  name: string;
  amountLabel: string;
  /** YYYY-MM-DD or ISO — the next due date. */
  dueDate: string;
};

/**
 * Reconcile scheduled reminders with current data.
 *
 * Everything is cancelled and re-scheduled so edits, deletions and toggles in
 * Profile actually take effect. Callers should pass already-localized strings
 * via `t` so reminders follow the app language.
 */
export async function syncNotifications(opts: {
  bills: BillReminder[];
  paydayDate?: Date | null;
  settings: NotifSettings;
  t: (key: string, params?: Record<string, string | number>) => string;
}): Promise<{ scheduled: number; permission: boolean }> {
  const { bills, paydayDate, settings, t } = opts;
  try {
    if (!(await ensureNotificationPermission())) return { scheduled: 0, permission: false };
    await Notifications.cancelAllScheduledNotificationsAsync();

    let scheduled = 0;
    const now = Date.now();
    const dayMs = 86_400_000;

    if (settings.billingReminder) {
      for (const bill of bills) {
        const when = reminderTime(bill.dueDate);
        if (!when) continue;
        // Only future reminders are meaningful; a past due date has already
        // been handled by recurring catch-up.
        if (when.getTime() <= now) continue;
        const days = Math.max(0, Math.ceil((when.getTime() - now) / dayMs));
        await scheduleAt(
          when,
          t('notif.bill.title'),
          t('notif.bill.body', { name: bill.name, amount: bill.amountLabel, days }),
          { type: 'billing', recId: bill.id },
        );
        scheduled += 1;
      }
    }

    if (settings.paydayReminder && paydayDate) {
      const when = reminderTime(paydayDate);
      if (when && when.getTime() > now) {
        const days = Math.max(0, Math.ceil((when.getTime() - now) / dayMs));
        await scheduleAt(
          when,
          t('notif.payday.title'),
          t('notif.payday.body', { days }),
          { type: 'payday' },
        );
        scheduled += 1;
      }
    }

    return { scheduled, permission: true };
  } catch {
    return { scheduled: 0, permission: false };
  }
}

/** Returns whether the notification was actually scheduled. */
export async function showLocalNotification(title: string, body: string, data?: Record<string, any>): Promise<boolean> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: data ?? {} },
      trigger: null,
    });
    return true;
  } catch {
    // Ignore: notifications are best-effort.
    return false;
  }
}

export async function cancelAllNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Ignore: notifications are best-effort.
  }
}

// --- Budget threshold alerts ---------------------------------------------

const BUDGET_ALERT_KEY = 'mf.notif.budgetAlerted';

export type BudgetUsage = {
  id: string;
  category: string;
  spent: number;
  amount: number;
  period?: string;
};

export type BudgetAlert = {
  budgetId: string;
  category: string;
  threshold: 80 | 100;
  spent: number;
  amount: number;
};

type AlertedMap = Record<string, string>;

/**
 * Which thresholds have already fired.
 *
 * Keyed by budget + threshold and stamped with the budget's period window, so
 * the alert re-arms when the period rolls over. Without the stamp a budget
 * would stay silent forever after crossing 100% once.
 */
async function readAlerted(): Promise<AlertedMap> {
  // The storage layer only accepts scalars, so this is JSON in a string —
  // the same convention as merchant-engine's mapping store.
  const raw = await storage.getItem<string>(BUDGET_ALERT_KEY, '{}');
  if (typeof raw !== 'string') return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as AlertedMap) : {};
  } catch {
    return {};
  }
}

export function evaluateBudgetAlerts(budgets: BudgetUsage[]): BudgetAlert[] {
  const alerts: BudgetAlert[] = [];
  for (const budget of budgets) {
    const amount = Number(budget.amount) || 0;
    const spent = Number(budget.spent) || 0;
    if (amount <= 0) continue;
    const pct = (spent / amount) * 100;
    if (pct >= 100) {
      alerts.push({ budgetId: budget.id, category: budget.category, threshold: 100, spent, amount });
    } else if (pct >= 80) {
      alerts.push({ budgetId: budget.id, category: budget.category, threshold: 80, spent, amount });
    }
  }
  return alerts;
}

/**
 * Fire a local notification for budgets that newly crossed 80% or 100%.
 * Returns the alerts that fired so the caller can also surface them in-app.
 */
export async function checkBudgetAlerts(opts: {
  budgets: BudgetUsage[];
  settings: NotifSettings;
  t: (key: string, params?: Record<string, string | number>) => string;
  formatMoney: (amount: number) => string;
  periodKey?: string;
}): Promise<BudgetAlert[]> {
  const { budgets, settings, t, formatMoney, periodKey = '' } = opts;
  if (!settings.budgetAlert) return [];

  try {
    const alerted = await readAlerted();
    const fired: BudgetAlert[] = [];
    const next: AlertedMap = { ...alerted };

    for (const alert of evaluateBudgetAlerts(budgets)) {
      const key = `${alert.budgetId}:${alert.threshold}`;
      // The stored value is the period stamp this threshold last fired in.
      const stamp = periodKey || String(new Date().getMonth() + 1);
      if (next[key] === stamp) continue;

      const over = alert.threshold >= 100;
      const delivered = await showLocalNotification(
        t(over ? 'notif.budget.over.title' : 'notif.budget.near.title'),
        t(over ? 'notif.budget.over.body' : 'notif.budget.near.body', {
          category: alert.category,
          spent: formatMoney(alert.spent),
          amount: formatMoney(alert.amount),
        }),
        { type: 'budget', budgetId: alert.budgetId },
      );
      // Only mark as alerted once it was actually delivered; otherwise a
      // denied-then-granted permission would silence the alert forever.
      if (delivered) next[key] = stamp;
      // But always surface it in-app: the OS notification may be blocked or
      // unnoticeable even when the user asked for budget alerts.
      fired.push(alert);
    }

    // Drop entries for budgets that no longer exist so the map cannot grow
    // unbounded as budgets are deleted.
    const live = new Set(budgets.map((b) => b.id));
    for (const key of Object.keys(next)) {
      if (!live.has(key.split(':')[0])) delete next[key];
    }

    // Persist only when the state actually changed. Writing an identical map
    // back on every check would be a pointless disk round trip.
    const changed = JSON.stringify(next) !== JSON.stringify(alerted);
    if (changed) await storage.setItem(BUDGET_ALERT_KEY, JSON.stringify(next));
    return fired;
  } catch {
    return [];
  }
}
