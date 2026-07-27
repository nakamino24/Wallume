import { useCallback, useEffect, useState } from 'react';

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function getPreviousBusinessDay(date: Date): Date {
  const prev = new Date(date);
  prev.setDate(prev.getDate() - 1);
  while (isWeekend(prev)) {
    prev.setDate(prev.getDate() - 1);
  }
  return prev;
}

export function calculateNextPayday(paydayDay: number): { nextDate: Date; daysRemaining: number; isPaydayToday: boolean } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();

  let paydayThisMonth = new Date(currentYear, currentMonth, paydayDay);
  if (isWeekend(paydayThisMonth)) {
    paydayThisMonth = getPreviousBusinessDay(paydayThisMonth);
  }

  if (paydayThisMonth < new Date(currentYear, currentMonth, currentDay)) {
    let nextMonth = currentMonth + 1;
    let nextYear = currentYear;
    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }
    let paydayNext = new Date(nextYear, nextMonth, paydayDay);
    if (isWeekend(paydayNext)) {
      paydayNext = getPreviousBusinessDay(paydayNext);
    }
    return {
      nextDate: paydayNext,
      daysRemaining: Math.ceil((paydayNext.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      isPaydayToday: false,
    };
  }

  const todayKey = `${currentYear}-${currentMonth}-${currentDay}`;
  const paydayKey = `${paydayThisMonth.getFullYear()}-${paydayThisMonth.getMonth()}-${paydayThisMonth.getDate()}`;
  return {
    nextDate: paydayThisMonth,
    daysRemaining: Math.ceil((paydayThisMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    isPaydayToday: todayKey === paydayKey,
  };
}

export function usePayday(paydayDayFromProfile?: number | null) {
  const [paydayDay, setPaydayDay] = useState<number>(25);

  useEffect(() => {
    if (paydayDayFromProfile && paydayDayFromProfile >= 1 && paydayDayFromProfile <= 31) {
      setPaydayDay(paydayDayFromProfile);
    }
  }, [paydayDayFromProfile]);

  const info = calculateNextPayday(paydayDay);

  return { paydayDay, info };
}