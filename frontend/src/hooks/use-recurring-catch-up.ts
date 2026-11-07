import { useEffect, useRef, useState } from 'react';
import { api } from '@/src/api/client';
import { storage } from '@/src/utils/storage';
import { invalidateWalletsCache } from '@/src/hooks/use-wallets';
import { invalidateTransactionsCache } from '@/src/hooks/use-transactions';

// One catch-up run per calendar day is enough: the backend advances each
// item's next_date atomically, so extra runs are no-ops anyway — this just
// avoids the round trip on every mount/navigation.
const LAST_RUN_KEY = 'mf.recurring.lastCatchUp';

function todayKey(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Post any recurring bills/incomes that fell due since the app was last
 * opened. This is what makes the app self-running rather than a manual
 * ledger the user has to remember to tap.
 */
export function useRecurringCatchUp(enabled: boolean) {
  const [postedCount, setPostedCount] = useState(0);
  const ran = useRef(false);

  useEffect(() => {
    if (!enabled || ran.current) return;
    ran.current = true;

    void (async () => {
      try {
        const today = todayKey();
        const lastRun = await storage.getItem<string>(LAST_RUN_KEY, '');
        if (lastRun === today) return;

        const result: any = await api.catchUpRecurring();
        const count = Number(result?.count ?? 0);

        // Only mark the day once the server confirmed; a failed call should
        // retry on the next launch rather than silently skip a day.
        await storage.setItem(LAST_RUN_KEY, today);

        if (count > 0) {
          invalidateWalletsCache();
          invalidateTransactionsCache();
          setPostedCount(count);
        }
      } catch {
        // Offline or transient failure: leave the day unmarked and try later.
      }
    })();
  }, [enabled]);

  return {
    postedCount,
    clearPosted: () => setPostedCount(0),
  };
}
