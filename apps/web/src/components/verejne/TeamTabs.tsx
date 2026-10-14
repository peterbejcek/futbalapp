import Link from 'next/link';

export interface TeamTabItem { href: string; label: string; active: boolean }

/** Prepínač ako odkazy (bez klientského JS). `div` namiesto `nav`, aby sa neaplikovali štýly hlavnej navigácie. */
export default function TeamTabs({ items, label, variant = 'team-tabs' }: { items: TeamTabItem[]; label: string; variant?: 'team-tabs' | 'filter' }) {
  return (
    <div className={variant} role="group" aria-label={label}>
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={i.active ? 'active' : undefined} aria-current={i.active ? 'page' : undefined}>
          {i.label}
        </Link>
      ))}
    </div>
  );
}
