import { ENGINE } from "./filmCopy";
import { useReveal } from "~/hooks/useReveal";
import "./act02-engine.css";

export function Act02Engine() {
  const { ref, shown } = useReveal<HTMLDivElement>();

  return (
    <section className="act-engine" aria-labelledby="engine-heading">
      <div
        className="mk-backdrop mk-backdrop--streams act-engine__backdrop"
        aria-hidden="true"
      />
      <div className="act-engine__inner">
        <div className="act-engine__copy">
          <p className="mk-eyebrow">
            <span className="mk-eyebrow__index">{ENGINE.eyebrow.index}</span>
            <span className="mk-eyebrow__sep" aria-hidden="true">
              /
            </span>
            <span className="mk-eyebrow__label">{ENGINE.eyebrow.label}</span>
          </p>
          <h2 id="engine-heading" className="visually-hidden">
            The engine: every dollar gets an account, every entry balances,
            nothing gets guessed
          </h2>

          <ol className="act-engine__beats">
            {ENGINE.beats.map((beat, i) => (
              <li className="act-engine__beat" key={beat.lead}>
                <span className="act-engine__beat-index">{`0${i + 1}`}</span>
                <div>
                  <p className="act-engine__beat-lead mk-display">{beat.lead}</p>
                  <p className="act-engine__beat-body">{beat.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div
          ref={ref}
          className={`act-engine__ledger${shown ? " is-in" : ""}`}
        >
          <div className="act-engine__ledger-head">
            <span>DATE</span>
            <span>PAYEE</span>
            <span>ACCOUNT</span>
            <span className="act-engine__num">DR</span>
            <span className="act-engine__num">CR</span>
          </div>
          <div className="act-engine__ledger-rows">
            {ENGINE.ledger.map((row, i) => (
              <div
                className="act-engine__row"
                key={`${row.payee}-${i}`}
                style={{ "--r": i } as React.CSSProperties}
              >
                <span className="act-engine__cell-date">{row.date}</span>
                <span className="act-engine__cell-payee">{row.payee}</span>
                <span className="act-engine__cell-account">{row.account}</span>
                <span className="act-engine__num act-engine__num--dr">
                  {row.debit}
                </span>
                <span className="act-engine__num act-engine__num--cr">
                  {row.credit}
                </span>
              </div>
            ))}
          </div>
          <div className="act-engine__ledger-foot">
            <span className="act-engine__balanced">
              <span className="act-engine__tick" aria-hidden="true">
                ✓
              </span>
              BALANCED
            </span>
            <span className="act-engine__foot-eq">
              debits = credits · 3,157.70 = 3,157.70
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
