// Brand hues shown as a small dot only — no logo marks or lookalike logos.
const BANKS: ReadonlyArray<{ name: string; hue: string }> = [
  { name: "BNZ", hue: "#003087" },
  { name: "ANZ", hue: "#007DBA" },
  { name: "ASB", hue: "#FFCC00" },
  { name: "Kiwibank", hue: "#6BA539" },
  { name: "Westpac", hue: "#D5002B" },
];

export function LiveProofStrip() {
  return (
    <section className="proof" aria-label="Supported banks">
      <span className="live-tag">
        <span className="live-dot" />
        Synced live via{" "}
        <a href="https://akahu.nz" target="_blank" rel="noopener noreferrer">
          <img src="/akahu-logo.svg" alt="" width="14" height="16" style={{ verticalAlign: "-2px", marginRight: "4px" }} />
          Akahu
        </a>
      </span>
      <ul className="proof__banks" aria-label="Connected banks">
        {BANKS.map((bank) => (
          <li className="bank-chip" key={bank.name}>
            <span className="bank-chip__dot" style={{ background: bank.hue }} aria-hidden="true" />
            {bank.name}
          </li>
        ))}
        <li className="bank-chip bank-chip--more">+ more</li>
      </ul>
    </section>
  );
}
