import { mapsSearchUrl } from '@/lib/maps';

/** Adresa ako odkaz na Google Maps. */
export function AddressLink({ address, className }: { address: string; className?: string }) {
  return (
    <a
      href={mapsSearchUrl(address)}
      target="_blank"
      rel="noopener noreferrer"
      title="Otvoriť v Google Maps"
      className={className ?? 'text-club-700 underline hover:text-club-900'}
      onClick={(e) => e.stopPropagation()}
    >
      {address}
      <span className="sr-only"> (otvorí sa v novom okne)</span>
    </a>
  );
}
