/**
 * Indonesian national holidays.
 * Fixed-date holidays are exact. Islamic/lunar holidays are approximate
 * and may shift by ±1 day depending on official government decree (SKB 3 Menteri).
 *
 * Yearly updates: check https://libur.nasional.id or
 * official SKB 3 Menteri for exact dates.
 */

// Major fixed-date holidays
const FIXED_HOLIDAYS: Record<number, { day: number; month: number; name: string }[]> = {
  2025: [
    { day: 1, month: 1, name: "Tahun Baru Masehi" },
    { day: 29, month: 3, name: "Hari Raya Nyepi" },
    { day: 18, month: 4, name: "Wafat Isa Almasih" },
    { day: 1, month: 5, name: "Hari Buruh Internasional" },
    { day: 29, month: 5, name: "Kenaikan Isa Almasih" },
    { day: 1, month: 6, name: "Hari Lahir Pancasila" },
    { day: 17, month: 8, name: "Hari Kemerdekaan RI" },
    { day: 25, month: 12, name: "Hari Raya Natal" },
  ],
  2026: [
    { day: 1, month: 1, name: "Tahun Baru Masehi" },
    { day: 29, month: 3, name: "Hari Raya Nyepi" },
    { day: 3, month: 4, name: "Wafat Isa Almasih" },
    { day: 1, month: 5, name: "Hari Buruh Internasional" },
    { day: 21, month: 5, name: "Kenaikan Isa Almasih" },
    { day: 1, month: 6, name: "Hari Lahir Pancasila" },
    { day: 17, month: 8, name: "Hari Kemerdekaan RI" },
    { day: 25, month: 12, name: "Hari Raya Natal" },
  ],
  2027: [
    { day: 1, month: 1, name: "Tahun Baru Masehi" },
    { day: 1, month: 5, name: "Hari Buruh Internasional" },
    { day: 1, month: 6, name: "Hari Lahir Pancasila" },
    { day: 17, month: 8, name: "Hari Kemerdekaan RI" },
    { day: 25, month: 12, name: "Hari Raya Natal" },
  ],
};

// Islamic/lunar holidays (approximate — ±1 day)
// Derived from predicted Hijri calendar
const LUNAR_HOLIDAYS: Record<number, { day: number; month: number; name: string }[]> = {
  2025: [
    { day: 27, month: 1, name: "Isra Mikraj" },
    { day: 31, month: 3, name: "Idul Fitri" },
    { day: 1, month: 4, name: "Idul Fitri" },
    { day: 2, month: 4, name: "Idul Fitri" },
    { day: 6, month: 6, name: "Idul Adha" },
    { day: 7, month: 6, name: "Idul Adha" },
    { day: 26, month: 6, name: "Tahun Baru Islam" },
    { day: 5, month: 9, name: "Maulid Nabi Muhammad" },
  ],
  2026: [
    { day: 16, month: 1, name: "Isra Mikraj" },
    { day: 20, month: 3, name: "Idul Fitri" },
    { day: 21, month: 3, name: "Idul Fitri" },
    { day: 22, month: 3, name: "Idul Fitri" },
    { day: 27, month: 5, name: "Idul Adha" },
    { day: 28, month: 5, name: "Idul Adha" },
    { day: 16, month: 6, name: "Tahun Baru Islam" },
    { day: 25, month: 8, name: "Maulid Nabi Muhammad" },
  ],
  2027: [
    { day: 5, month: 1, name: "Isra Mikraj" },
    { day: 9, month: 3, name: "Idul Fitri" },
    { day: 10, month: 3, name: "Idul Fitri" },
    { day: 11, month: 3, name: "Idul Fitri" },
    { day: 17, month: 5, name: "Idul Adha" },
    { day: 18, month: 5, name: "Idul Adha" },
    { day: 5, month: 6, name: "Tahun Baru Islam" },
    { day: 15, month: 8, name: "Maulid Nabi Muhammad" },
  ],
};

// Joint holiday leave (Cuti Bersama) — declared annually by government
const COLLECTIVE_LEAVE: Record<number, { day: number; month: number; name: string }[]> = {
  2025: [
    { day: 28, month: 3, name: "Cuti Bersama Idul Fitri" },
    { day: 3, month: 4, name: "Cuti Bersama Idul Fitri" },
    { day: 4, month: 4, name: "Cuti Bersama Idul Fitri" },
    { day: 7, month: 4, name: "Cuti Bersama Idul Fitri" },
    { day: 30, month: 5, name: "Cuti Bersama Idul Adha" },
    { day: 26, month: 12, name: "Cuti Bersama Natal" },
  ],
  2026: [
    { day: 19, month: 3, name: "Cuti Bersama Idul Fitri" },
    { day: 23, month: 3, name: "Cuti Bersama Idul Fitri" },
    { day: 24, month: 3, name: "Cuti Bersama Idul Fitri" },
  ],
  2027: [],
};

function getYearData(year: number) {
  return [
    ...(FIXED_HOLIDAYS[year] || []),
    ...(LUNAR_HOLIDAYS[year] || []),
    ...(COLLECTIVE_LEAVE[year] || []),
  ];
}

export function getIndonesianHolidays(year: number): { day: number; month: number; name: string }[] {
  return getYearData(year);
}

export function isIndonesianHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const day = date.getDate();
  const month = date.getMonth() + 1; // JS months are 0-indexed
  return getYearData(year).some((h) => h.day === day && h.month === month);
}