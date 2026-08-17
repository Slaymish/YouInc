import { SELF_HOST } from "./filmCopy";
import { SELF_HOST_URL, SOURCE_URL } from "../config";
import "./act05-selfhost.css";

export function Act05SelfHost() {
  return (
    <section className="act-selfhost" aria-labelledby="selfhost-heading">
      <div className="act-selfhost__inner">
        <header className="act-selfhost__head">
          <p className="mk-eyebrow">
            <span className="mk-eyebrow__index">{SELF_HOST.eyebrow.index}</span>
            <span className="mk-eyebrow__sep" aria-hidden="true">
              /
            </span>
            <span className="mk-eyebrow__label">{SELF_HOST.eyebrow.label}</span>
          </p>
          <h2 id="selfhost-heading" className="act-selfhost__headline mk-display">
            Your ledger, <em>on your machine.</em>
          </h2>
          <p className="act-selfhost__body mk-lede">{SELF_HOST.body}</p>
        </header>

        <ul className="act-selfhost__grid">
          {SELF_HOST.steps.map((step, i) => (
            <li className="act-selfhost__card" key={step.title}>
              <span className="act-selfhost__index">
                {`STEP 0${i + 1}`}
              </span>
              <p className="act-selfhost__brief">{step.title}</p>
              <dl className="act-selfhost__spec">
                <div>
                  <dt>What happens</dt>
                  <dd>{step.body}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>

        <div className="act-selfhost__cta">
          <a
            className="mk-btn mk-btn--primary"
            href={SELF_HOST_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="mk-btn__label">Read the setup guide</span>
          </a>
          <span className="act-selfhost__note">
            Source on{" "}
            <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>{" "}
            — issues and pull requests welcome.
          </span>
        </div>
      </div>
    </section>
  );
}
