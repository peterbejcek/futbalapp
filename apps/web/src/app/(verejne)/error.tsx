'use client';

/** Hranica chýb verejného webu: nikdy nezobrazuje náhradné dáta. */
export default function PublicError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="section">
      <div className="empty" role="alert">
        <h3>Údaje sú dočasne nedostupné. Skúste to neskôr.</h3>
        <p>
          <button type="button" className="btn" onClick={() => reset()}>Skúsiť znova</button>
        </p>
      </div>
    </section>
  );
}
