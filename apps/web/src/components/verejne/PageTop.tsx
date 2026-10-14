import type { ReactNode } from 'react';

/** Tmavá hlavička podstránky (štítok, veľký nadpis, popis, voliteľný obsah pod ním). */
export default function PageTop({ label, title, desc, children }: { label: string; title: string; desc: string; children?: ReactNode }) {
  return (
    <section className="page-top">
      <div className="eyebrow">{label}</div>
      <h1>{title}</h1>
      <p>{desc}</p>
      {children}
    </section>
  );
}
