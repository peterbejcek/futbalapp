/** Načítavanie dátových trás verejného webu (skeleton v štýle webu). */
export default function Loading() {
  return (
    <section className="section" aria-busy="true" aria-live="polite">
      <p className="loading-text">Načítavam…</p>
      <div className="skeleton-grid" aria-hidden="true">
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    </section>
  );
}
