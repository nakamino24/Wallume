import { useEffect, useState } from 'react';
import { isIndonesianHoliday } from '@/src/lib/indonesian-holidays';

// workWeek = number of working days per week (5, 6, or 7).
// 5: Sat-Sun off, 6: Sunday off, 7: no weekend off (holidays only).
function isWeekendDay(day: number, workWeek: number): boolean {
  if (workWeek === 7) return false;
  if (workWeek === 6) return day === 0; // Sunday only
  return day === 0 || day === 6; // Sat + Sun
}

function isNonBusinessDay(date: Date, workWeek: number): boolean {
  return isWeekendDay(date.getDay(), workWeek) || isIndonesianHoliday(date);
}

function getPreviousBusinessDay(date: Date, workWeek: number): Date {
  const prev = new Date(date);
  prev.setDate(prev.getDate() - 1);
  while (isNonBusinessDay(prev, workWeek)) {
    prev.setDate(prev.getDate() - 1);
  }
  return prev;
}

// Wallume convention: if payday falls on a non-working day, it is paid on the
// previous working day (matches the original requirement — paid on Friday when
// the 25th falls on a weekend, or the day before a holiday).
export function calculateNextPayday(paydayDay: number, workWeek: number = 5): { nextDate: Date; daysRemaining: number; isPaydayToday: boolean } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();

  let paydayThisMonth = new Date(currentYear, currentMonth, paydayDay);
  if (isNonBusinessDay(paydayThisMonth, workWeek)) {
    paydayThisMonth = getPreviousBusinessDay(paydayThisMonth, workWeek);
  }

  if (paydayThisMonth < new Date(currentYear, currentMonth, currentDay)) {
    let nextMonth = currentMonth + 1;
    let nextYear = currentYear;
    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }
    let paydayNext = new Date(nextYear, nextMonth, paydayDay);
    if (isNonBusinessDay(paydayNext, workWeek)) {
      paydayNext = getPreviousBusinessDay(paydayNext, workWeek);
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

export function usePayday(paydayDayFromProfile?: number | null, workWeekFromProfile?: number | null) {
  const [paydayDay, setPaydayDay] = useState<number>(25);
  const [workWeek, setWorkWeek] = useState<number>(5);

  useEffect(() => {
    if (paydayDayFromProfile && paydayDayFromProfile >= 1 && paydayDayFromProfile <= 31) {
      setPaydayDay(paydayDayFromProfile);
    }
  }, [paydayDayFromProfile]);

  useEffect(() => {
    if (workWeekFromProfile === 5 || workWeekFromProfile === 6 || workWeekFromProfile === 7) {
      setWorkWeek(workWeekFromProfile);
    }
  }, [workWeekFromProfile]);

  const info = calculateNextPayday(paydayDay, workWeek);

  return { paydayDay, workWeek, setPaydayDay, setWorkWeek, info };
}