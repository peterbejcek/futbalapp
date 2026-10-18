'use client';

import { useState } from 'react';
import { mapsEmbedUrl } from '@/lib/maps';

/** Mapa sa z Googlu načíta až po kliknutí (súkromie). */
export function MapEmbed({ address }: { address: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
      >
        {open ? 'Skryť mapu' : 'Zobraziť mapu'}
      </button>
      {open && (
        <iframe
          src={mapsEmbedUrl(address)}
          title={`Mapa: ${address}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin"
          className="mt-2 h-72 w-full rounded-md border border-gray-200"
        />
      )}
    </div>
  );
}
