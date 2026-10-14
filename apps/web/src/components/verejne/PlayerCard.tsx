import Image from 'next/image';
import type { PublicPlayer } from '@/lib/verejne/types';

const POS: Record<string, string> = { Brankár: 'BRANKÁR', Obranca: 'OBRANA', Stredopoliar: 'STRED', Útočník: 'ÚTOK' };

/** Verejná karta hráča: meno, priezvisko, číslo, pozícia; fotka len so súhlasom (photoUrl). Nie je klikateľná. */
export default function PlayerCard({ player }: { player: PublicPlayer }) {
  const pos = player.position ? (POS[player.position] ?? player.position.toUpperCase()) : null;
  return (
    <article className="player" aria-label={`${player.firstName} ${player.lastName}`}>
      {player.photoUrl ? (
        <span
          className="portrait"
          role="img"
          aria-label={`Fotografia: ${player.firstName} ${player.lastName}`}
          style={{ backgroundImage: `url(${player.photoUrl})`, backgroundPosition: player.photoPosition ?? undefined }}
        />
      ) : (
        <span className="portrait ph" aria-hidden="true" />
      )}
      <span className="player-number">
        {player.shirtNumber ?? ''}
        {pos && <small>{pos}</small>}
      </span>
      <Image className="mini-logo" src="/logo.png" alt="" width={22} height={35} />
      <span className="player-name">
        <b>{player.firstName}</b>
        {player.lastName}
      </span>
    </article>
  );
}
