'use client';

import { useState } from 'react';

/** Logo súpera z databázy; ak chýba alebo sa nenačíta, zobrazí sa štít so skratkou názvu. */
export default function ClubLogo({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const abbr = name.replace(/[^\p{L}]/gu, '').slice(0, 3).toUpperCase();
  if (!src || failed) {
    return (
      <span className="club-icon" aria-hidden="true">
        {abbr}
      </span>
    );
  }
  return (
    // Externý obrázok z registra klubov: bez referrera, lenivé načítanie.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="club-logo"
      src={src}
      alt=""
      width={37}
      height={42}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
