import { Link } from "@tanstack/react-router";
import { CLOSE } from "./filmCopy";
import "./act07-close.css";

export function Act07Close() {
  return (
    <section className="act-close" aria-labelledby="close-heading">
      <div className="mk-backdrop mk-backdrop--close act-close__backdrop" aria-hidden="true" />
      <div className="act-close__content">
        <p className="mk-eyebrow act-close__eyebrow">
          <span className="mk-eyebrow__index">{CLOSE.eyebrow.index}</span>
          <span className="mk-eyebrow__sep" aria-hidden="true">
            /
          </span>
          <span className="mk-eyebrow__label">{CLOSE.eyebrow.label}</span>
        </p>
        <h2 id="close-heading" className="act-close__headline mk-display">
          Incorporate <em>yourself.</em>
        </h2>
        <div className="act-close__cta start-free">
          <Link className="mk-btn mk-btn--primary" to="/signup">
            <span className="mk-btn__label">Start free</span>
          </Link>
        </div>
        <p className="act-close__reassurance">{CLOSE.reassurance}</p>
      </div>
    </section>
  );
}
