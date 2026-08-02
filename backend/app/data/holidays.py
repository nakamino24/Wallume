"""Indonesian national holidays for the backend (Company Working Calendar).

Mirrors the frontend `indonesian-holidays.ts` so payday/forecast calculations
are consistent across the app. Fixed dates are exact; lunar/Islamic dates are
approximate and shift ±1 day per the official SKB 3 Menteri decree.
"""

from datetime import date

FIXED = {
    2025: {(1, 1), (3, 29), (4, 18), (5, 1), (5, 29), (6, 1), (8, 17), (12, 25)},
    2026: {(1, 1), (3, 29), (4, 3), (5, 1), (5, 21), (6, 1), (8, 17), (12, 25)},
    2027: {(1, 1), (5, 1), (6, 1), (8, 17), (12, 25)},
}

LUNAR = {
    2025: {(1, 27), (3, 31), (4, 1), (4, 2), (6, 6), (6, 7), (6, 26), (9, 5)},
    2026: {(1, 16), (3, 20), (3, 21), (3, 22), (5, 27), (5, 28), (6, 16), (8, 25)},
    2027: {(1, 5), (3, 9), (3, 10), (3, 11), (5, 17), (5, 18), (6, 5), (8, 15)},
}

COLLECTIVE = {
    2025: {(3, 28), (4, 3), (4, 4), (4, 7), (5, 30), (12, 26)},
    2026: {(3, 19), (3, 23), (3, 24)},
    2027: set(),
}

_HOLIDAYS = {year: FIXED.get(year, set()) | LUNAR.get(year, set()) | COLLECTIVE.get(year, set())
             for year in set(FIXED) | set(LUNAR) | set(COLLECTIVE)}


def is_holiday(d: date) -> bool:
    return (d.month, d.day) in _HOLIDAYS.get(d.year, set())
