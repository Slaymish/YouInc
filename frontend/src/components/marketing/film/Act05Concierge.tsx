import { CONCIERGE } from "./filmCopy";
import { BOOKING_URL } from "../config";
import "./act05-concierge.css";

export function Act05Concierge() {
  return (
    <section className="act-concierge" aria-labelledby="concierge-heading">
      <div className="act-concierge__inner">
        <header className="act-concierge__head">
          <p className="mk-eyebrow">
            <span className="mk-eyebrow__index">{CONCIERGE.eyebrow.index}</span>
            <span className="mk-eyebrow__sep" aria-hidden="true">
              /
            </span>
            <span className="mk-eyebrow__label">{CONCIERGE.eyebrow.label}</span>
          </p>
          <h2 id="concierge-heading" className="act-concierge__headline mk-display">
            Your own <em>engineering department.</em>
          </h2>
          <p className="act-concierge__body mk-lede">{CONCIERGE.body}</p>
        </header>

        <ul className="act-concierge__grid">
          {CONCIERGE.artifacts.map((a, i) => (
            <li className="act-concierge__card" key={a.brief}>
              <span className="act-concierge__index">{`COMMISSION 0${i + 1}`}</span>
              <p className="act-concierge__brief">{a.brief}</p>
              <dl className="act-concierge__spec">
                <div>
                  <dt>Built</dt>
                  <dd>{a.built}</dd>
                </div>
                <div>
                  <dt>Shipped</dt>
                  <dd>{a.shipped}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>

        <div className="act-concierge__cta">
          <a
            className="mk-btn mk-btn--primary"
            href={BOOKING_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="mk-btn__label">Book a call</span>
          </a>
          <span className="act-concierge__note">
            Illustrative of the work — scoped one-off builds from NZD $1,500.
          </span>
        </div>
      </div>
    </section>
  );
}
