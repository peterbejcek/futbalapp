import Image from 'next/image';
import type { PublicPlayerDto } from '@fkknv/shared';
import { publicPhotoSrc } from '@/lib/verejne/public-api';

/** Verejná karta hráča: iba meno a priezvisko; fotka LEN ak existuje photoUrl, inak neutrálna silueta. */
export default function PlayerCard({ player }: { player: PublicPlayerDto }) {
  const name = `${player.firstName} ${player.lastName}`;
  return (
    <article className="player" aria-label={name}>
      {player.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="portrait-img" src={publicPhotoSrc(player.photoUrl)} alt={name} loading="lazy" />
      ) : (
        <span className="portrait ph" aria-hidden="true" />
      )}
      <Image className="mini-logo" src="/logo.png" alt="" width={22} height={35} />
      <span className="player-name">
        <b>{player.firstName}</b>
        {player.lastName}
      </span>
    </article>
  );
}
