import { Link } from "@tanstack/react-router";
import { SELF_HOST_URL } from "../config";
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
          {CLOSE.headline.lead} <em>{CLOSE.headline.em}</em>
        </h2>
        <div className="act-close__cta">
          <Link className="mk-btn mk-btn--primary" to="/demo">
            <span className="mk-btn__label">Open the demo</span>
          </Link>
          <a
            className="mk-btn mk-btn--ghost"
            href={SELF_HOST_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="mk-btn__label">Run it yourself</span>
          </a>
        </div>
        <p className="act-close__reassurance">{CLOSE.reassurance}</p>
      </div>
    </section>
  );
}
