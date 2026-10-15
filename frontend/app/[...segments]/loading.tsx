export default function LocationLoading() {
  return <main className="location-results" aria-busy="true" aria-live="polite">
    <p role="status">Loading schools and location details…</p>
    <div className="school-list school-list--skeleton" aria-hidden="true">
      <article className="school-skeleton"><span /><div><span /><span /><span /></div></article>
      <article className="school-skeleton"><span /><div><span /><span /><span /></div></article>
    </div>
  </main>;
}
