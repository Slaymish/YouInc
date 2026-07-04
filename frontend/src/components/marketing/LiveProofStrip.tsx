import "./LiveProofStrip.css";

// Brand hues shown as a small dot only — no logo marks or lookalike logos.
const BANKS: ReadonlyArray<{ name: string; hue: string }> = [
  { name: "BNZ", hue: "#003087" },
  { name: "ANZ", hue: "#007DBA" },
  { name: "ASB", hue: "#FFCC00" },
  { name: "Sharesies", hue: "#E52872" },
  { name: "Kiwibank", hue: "#6BA539" },
  { name: "Westpac", hue: "#D5002B" },
  { name: "Wise", hue: "#80E142" },
  { name: "Heartland", hue: "#9C60DD" },
  { name: "SBS", hue: "#FF6802" },
  { name: "TSB", hue: "#1B124D" },
  { name: "Simplicity", hue: "#FF5B00" },
];

interface ProofTrackProps {
  /** True for the duplicate track that exists only to make the marquee loop
   * seamlessly — hidden from assistive tech and removed from tab order so
   * screen reader / keyboard users see the real content exactly once. */
  duplicate?: boolean;
}

function ProofTrack({ duplicate = false }: ProofTrackProps) {
  return (
    <div className="proof__track" aria-hidden={duplicate || undefined}>
      <span className="live-tag proof__pill">
        <span className="live-dot" />
        Synced live via{" "}
        <a
          href="https://akahu.nz"
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={duplicate ? -1 : undefined}
        >
          <img
            src="/akahu-logo.svg"
            alt=""
            width="14"
            height="16"
            style={{ verticalAlign: "-2px", marginRight: "4px" }}
          />
          Akahu
        </a>
      </span>
      <ul
        className="proof__banks"
        aria-label={duplicate ? undefined : "Connected banks"}
      >
        {BANKS.map((bank) => (
          <li className="bank-chip" key={bank.name}>
            <span
              className="bank-chip__dot"
              style={{ background: bank.hue }}
              aria-hidden="true"
            />
            {bank.name}
          </li>
        ))}
        <a
          href="https://akahu.nz"
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={duplicate ? -1 : undefined}
        >
          <li className="bank-chip bank-chip--more">+ more</li>
        </a>
      </ul>
    </div>
  );
}

export function LiveProofStrip() {
  return (
    <section className="proof" aria-label="Supported banks">
      <div className="proof__viewport">
        <div className="proof__marquee">
          <ProofTrack />
          <ProofTrack duplicate />
        </div>
      </div>
    </section>
  );
}
