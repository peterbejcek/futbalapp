import { getPublicData } from '@/lib/verejne/data-source';

/** Zobrazí sa iba keď web číta z demo fixtures (nikdy v produkcii s reálnym zdrojom). */
export default function DemoNotice({ children }: { children?: React.ReactNode }) {
  if (!getPublicData().isDemo) return null;
  return <p className="tiny-note">{children ?? 'Ukážkové údaje na lokálny náhľad. Po napojení sa načítajú z klubového portálu.'}</p>;
}
