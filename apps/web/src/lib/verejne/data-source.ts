import type { PublicDataSource } from './types';
import { demoDataSource } from './demo-fixtures/demo-source';

/**
 * Prepínač zdroja dát verejného webu.
 * TODO: keď backend vystaví verejné read-only endpointy (modul `public`, súhlasy hráčov,
 * CRUD článkov), pridať `api-source.ts` a vrátiť ho tu. Dovtedy iba demo fixtures —
 * nikdy nezapisujú do databázy.
 */
export function getPublicData(): PublicDataSource {
  return demoDataSource;
}
