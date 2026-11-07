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

export async function showLocalNotification(title: string, body: string, data?: Record<string, any>) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: data ?? {} },
      trigger: null,
    });
  } catch {
    // Ignore: notifications are best-effort.
  }
}

export async function cancelAllNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Ignore: notifications are best-effort.
  }
}
