import { Link } from "@tanstack/react-router";
import { PIPELINE } from "./filmCopy";
import { useReveal } from "~/hooks/useReveal";
import "./act04-proof.css";

export function Act04Pipeline() {
  const { ref, shown } = useReveal<HTMLDivElement>();

  return (
    <section className="act-pipeline" aria-labelledby="pipeline-heading">
      <div className="act-pipeline__inner">
        <header className="act-pipeline__head">
          <p className="mk-eyebrow">
            <span className="mk-eyebrow__index">{PIPELINE.eyebrow.index}</span>
            <span className="mk-eyebrow__sep" aria-hidden="true">
              /
            </span>
            <span className="mk-eyebrow__label">{PIPELINE.eyebrow.label}</span>
          </p>
          <h2 id="pipeline-heading" className="act-pipeline__headline mk-display">
            {PIPELINE.headline}
          </h2>
        </header>

        <div ref={ref} className={`act-pipeline__log${shown ? " is-in" : ""}`}>
          {PIPELINE.log.map((line, i) => (
            <div
              className={`act-pipeline__line${"live" in line ? " act-pipeline__line--live" : ""}`}
              key={line.label}
              style={{ "--l": i } as React.CSSProperties}
            >
              <span className="act-pipeline__glyph">{line.glyph}</span>
              <span className="act-pipeline__label">{line.label}</span>
              <span className="act-pipeline__dots" aria-hidden="true">
                {".".repeat(line.dots)}
              </span>
              <span className="act-pipeline__value">{line.value}</span>
            </div>
          ))}
        </div>

        <ol className="act-pipeline__steps">
          {PIPELINE.steps.map((step, i) => (
            <li className="act-pipeline__step" key={step.title}>
              <span className="act-pipeline__step-n">{`0${i + 1}`}</span>
              <h3 className="act-pipeline__step-title">{step.title}</h3>
              <p className="act-pipeline__step-body">{step.body}</p>
            </li>
          ))}
        </ol>

        <p className="act-pipeline__foot">
          <Link className="mk-btn mk-btn--ghost" to="/demo">
            <span className="mk-btn__label">See it running on sample data</span>
          </Link>
        </p>
      </div>
    </section>
  );
}
