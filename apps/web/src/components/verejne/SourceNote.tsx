export const CLUB_BASE = 'https://www.fkkosickanovaves.sk/';

/** Externý odkaz (nová karta, bez referrera). */
export function ExtLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return <a className={className} href={href} target="_blank" rel="noopener">{children}</a>;
}

/** Poznámka o pôvode údajov z pôvodného klubového webu. */
export default function SourceNote({ path = '', label = 'Pôvodný klubový web' }: { path?: string; label?: string }) {
  return (
    <p className="source">
      Zdroj: <ExtLink href={CLUB_BASE + path}>{label} ↗</ExtLink>. Údaje pochádzajú z pôvodného klubového webu; platnosť pre sezónu 2026/27 treba potvrdiť.
    </p>
  );
}
