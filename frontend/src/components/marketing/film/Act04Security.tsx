import { Link } from "@tanstack/react-router";
import { SECURITY } from "./filmCopy";
import "./act04-proof.css";

export function Act04Security() {
  return (
    <section className="act-security" aria-labelledby="security-heading">
      <div className="act-security__inner">
        <div className="act-security__statement">
          <p className="mk-eyebrow">
            <span className="mk-eyebrow__index">{SECURITY.eyebrow.index}</span>
            <span className="mk-eyebrow__sep" aria-hidden="true">
              /
            </span>
            <span className="mk-eyebrow__label">{SECURITY.eyebrow.label}</span>
          </p>
          <h2 id="security-heading" className="act-security__headline mk-display">
            {SECURITY.headline.lead} <em>{SECURITY.headline.em}</em>
          </h2>
          <Link className="act-security__link" to="/security">
            More on security →
          </Link>
        </div>

        <dl className="act-security__entries">
          {SECURITY.entries.map((entry) => (
            <div className="act-security__entry" key={entry.label}>
              <dt className="act-security__label">{entry.label}</dt>
              <dd className="act-security__body">{entry.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
