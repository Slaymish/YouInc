export function LiveProofStrip() {
  return (
    <section className="proof" aria-label="Supported banks">
      <span className="live-tag">
        <span className="live-dot" />
        Synced live via{" "}
        <a href="https://akahu.nz" target="_blank" rel="noopener noreferrer">
          Akahu
        </a>
      </span>
      <span className="proof__banks">BNZ · ANZ · ASB · Kiwibank · Westpac · +more</span>
    </section>
  );
}
