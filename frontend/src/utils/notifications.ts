import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { storage } from '@/src/utils/storage';

const KEYS = {
  billingReminder: 'mf.notif.billingReminder',
  budgetAlert: 'mf.notif.budgetAlert',
  paydayReminder: 'mf.notif.paydayReminder',
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  const result = await Notifications.requestPermissionsAsync();
  return !!result;
}

export async function scheduleBillingReminder(name: string, amount: string, daysUntil: number, recId: string) {
  if (daysUntil < 0) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Upcoming bill',
      body: `${name} — ${amount} is due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`,
      data: { type: 'billing', recId },
    },
    trigger: daysUntil === 0 ? null : { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 10, repeats: false },
  });
}

export async function schedulePaydayReminder(daysUntil: number) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Payday is coming',
      body: daysUntil === 0
        ? 'Payday is today! Check your salary deposit.'
        : `Payday in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}.`,
      data: { type: 'payday' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 10, repeats: false },
  });
}

export async function showLocalNotification(title: string, body: string, data?: Record<string, any>) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: data ?? {} },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2, repeats: false },
  });
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}