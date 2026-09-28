import * as Updates from 'expo-updates';

/**
 * Spoľahlivé OTA aktualizácie (EAS Update).
 *
 * app.json má `fallbackToCacheTimeout: 0` → appka pri štarte načíta zabudovaný
 * balík a nový update sťahuje na pozadí (aplikuje sa až pri ďalšom štarte). Aby
 * sa update prejavil hneď pri prvom otvorení, pri štarte aktívne skontrolujeme
 * a stiahneme novú verziu a reštartneme do nej. V Expo Go / dev je to vypnuté.
 */
export async function applyUpdatesOnLaunch(): Promise<void> {
  if (!Updates.isEnabled || __DEV__) return;
  try {
    const check = await Updates.checkForUpdateAsync();
    if (check.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch {
    // sieť/žiadny update — pokračujeme s aktuálnym balíkom
  }
}

/** Manuálna kontrola (tlačidlo v appke). Vráti stav pre zobrazenie hlášky. */
export async function checkForUpdateNow(): Promise<'updated' | 'current' | 'unavailable' | 'error'> {
  if (!Updates.isEnabled || __DEV__) return 'unavailable';
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return 'current';
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
    return 'updated';
  } catch {
    return 'error';
  }
}

/** Krátky popis bežiacej verzie balíka pre diagnostiku. */
export function runningBundleLabel(): string {
  if (!Updates.isEnabled) return 'vývojová verzia';
  if (Updates.isEmbeddedLaunch) return 'základná verzia (bez OTA)';
  const id = Updates.updateId ? Updates.updateId.slice(0, 8) : '—';
  const when = Updates.createdAt ? ` · ${Updates.createdAt.toLocaleDateString('sk-SK')}` : '';
  return `aktualizovaná (${id}${when})`;
}
