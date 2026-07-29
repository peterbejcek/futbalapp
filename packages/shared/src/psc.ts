/**
 * Približné doplnenie mesta z PSČ (best-effort). Pokrýva Košice a okresné mestá
 * podľa prefixu PSČ. Nie je to úplný číselník — pole mesto ostáva editovateľné.
 * Neskôr sa dá nahradiť kompletným číselníkom Slovenskej pošty.
 */

/** Prefix PSČ (bez medzier) → mesto. Dlhšie prefixy majú prednosť. */
const PREFIX_TO_CITY: Array<[string, string]> = [
  ['040', 'Košice'], // Košice mestské časti 040 01–040 23 (vrátane 040 14 Košická Nová Ves)
  ['080', 'Prešov'],
  ['058', 'Poprad'],
  ['052', 'Spišská Nová Ves'],
  ['048', 'Rožňava'],
  ['071', 'Michalovce'],
  ['075', 'Trebišov'],
  ['066', 'Humenné'],
  ['085', 'Bardejov'],
  ['010', 'Žilina'],
  ['036', 'Martin'],
  ['974', 'Banská Bystrica'],
  ['917', 'Trnava'],
  ['911', 'Trenčín'],
  ['949', 'Nitra'],
  ['950', 'Nitra'],
  ['811', 'Bratislava'],
  ['821', 'Bratislava'],
  ['831', 'Bratislava'],
  ['841', 'Bratislava'],
  ['851', 'Bratislava'],
];

/** Vráti mesto pre PSČ, alebo null ak nie je v tabuľke. */
export function pscToMesto(psc: string): string | null {
  const d = (psc ?? '').replace(/\s/g, '');
  if (d.length < 3) return null;
  for (const [prefix, city] of PREFIX_TO_CITY) {
    if (d.startsWith(prefix)) return city;
  }
  return null;
}
