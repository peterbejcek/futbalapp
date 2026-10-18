'use client';

import { useState } from 'react';
import { mapsEmbedUrl } from '@/lib/maps';

/** Mapa sa z Googlu načíta až po kliknutí (súkromie). */
export default function PublicMap({ address }: { address: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="map-toggle">
      <button type="button" className="btn outline" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? 'Skryť mapu' : 'Zobraziť mapu'}
      </button>
      {open && (
        <iframe
          className="map-frame"
          src={mapsEmbedUrl(address)}
          title={`Mapa: ${address}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin"
        />
      )}
    </div>
  );
}
