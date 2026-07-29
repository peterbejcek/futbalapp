'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'fkknv_cookie_consent';

/**
 * Lišta so súhlasom s cookies. Portál používa lokálne úložisko len na
 * nevyhnutné účely (prihlásenie); voľba používateľa sa uloží a lišta sa
 * pri ďalších návštevách nezobrazuje.
 */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // súkromný režim / blokované úložisko — lištu nezobrazíme
    }
  }, []);

  function decide(choice: 'all' | 'necessary') {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ choice, at: new Date().toISOString() }),
      );
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-lg border border-club-100 bg-white p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600">
          Používame len nevyhnutné cookies a lokálne úložisko potrebné na prihlásenie a fungovanie portálu.
          Nepoužívame sledovacie ani reklamné cookies.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => decide('necessary')}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Iba nutné
          </button>
          <button
            onClick={() => decide('all')}
            className="rounded-md bg-club-600 px-4 py-2 text-sm font-semibold text-white hover:bg-club-700"
          >
            Prijať všetky
          </button>
        </div>
      </div>
    </div>
  );
}
