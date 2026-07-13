import { COMMAND } from "./filmCopy";
import { CommandDeck } from "./CommandDeck";
import { useReveal } from "~/hooks/useReveal";
import "./act03-command.css";

export function Act03Command() {
  const { ref, shown } = useReveal<HTMLDivElement>();

  return (
    <section className="act-command" aria-labelledby="command-heading">
      <div className="act-command__inner">
        <header className="act-command__head">
          <p className="mk-eyebrow">
            <span className="mk-eyebrow__index">{COMMAND.eyebrow.index}</span>
            <span className="mk-eyebrow__sep" aria-hidden="true">
              /
            </span>
            <span className="mk-eyebrow__label">{COMMAND.eyebrow.label}</span>
          </p>
          <h2 id="command-heading" className="act-command__headline mk-display">
            {COMMAND.headline}
          </h2>
          <p className="act-command__body mk-lede">{COMMAND.body}</p>
        </header>

        <div ref={ref} className={`act-command__deck${shown ? " is-in" : ""}`}>
          <CommandDeck />
        </div>
      </div>
    </section>
  );
}
