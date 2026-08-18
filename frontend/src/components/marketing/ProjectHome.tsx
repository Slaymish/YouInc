// The public front page. Not a product pitch — a description of the project,
// a link to the demo, and how to run it. The seven-act landing film that used
// to live here was removed along with the rest of the product surface.
import { Link, useRouteContext } from "@tanstack/react-router";
import { MarketingHeader } from "./shell/MarketingHeader";
import { MarketingFooter } from "./shell/MarketingFooter";
import { useDarkTheme } from "./system/useDarkTheme";
import { PRODUCT, SOURCE_URL } from "./config";
import "./marketing-tokens.css";
import "./system/base.css";
import "./system/primitives.css";
import "./marketing-shared.css";
import "./project-home.css";

interface Part {
  readonly title: string;
  readonly body: string;
}

const INSIDE: readonly Part[] = [
  {
    title: "One ledger",
    body: "Every transaction posts to a double-entry ledger in Postgres, so the totals on screen always add up to something you can inspect.",
  },
  {
    title: "Bank sync",
    body: "New Zealand accounts sync through Akahu using credentials you obtain yourself. Anything a feed can't reach — a house, a car, a private loan — you enter by hand and it sits in the same list.",
  },
  {
    title: "Sorting that you control",
    body: "Transactions are sorted by rules you can read and change. Anything the rules can't place waits in one short list until you categorise it.",
  },
  {
    title: "Exports",
    body: "The whole history writes out as hledger-compatible plain text, so it stays readable in other tools.",
  },
];

export function ProjectHome() {
  useDarkTheme();
  const { authenticated } = useRouteContext({ from: "__root__" });

  return (
    <div className="mk">
      <MarketingHeader authenticated={authenticated} />

      <main className="mk-content ph">
        <section className="ph-hero" aria-labelledby="ph-heading">
          <p className="mk-eyebrow">{PRODUCT.heroEyebrow}</p>
          <h1 id="ph-heading" className="ph-hero__headline">
            {PRODUCT.heroHeadline}
          </h1>
          <p className="ph-hero__sub">{PRODUCT.heroSub}</p>
          <p className="ph-hero__sub">
            It runs on your own machine against your own database. There's no
            hosted version and no account on this site — what's here is a demo
            on sample data and the documentation.
          </p>
          <div className="ph-hero__actions">
            <Link className="mk-btn mk-btn--primary" to="/demo">
              <span className="mk-btn__label">Open the demo</span>
            </Link>
            <a
              className="mk-btn mk-btn--ghost"
              href={SOURCE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="mk-btn__label">Source on GitHub</span>
            </a>
          </div>
          <p className="ph-hero__note">{PRODUCT.heroReassurance}</p>
        </section>

        <section className="ph-shot" aria-label="The application">
          {/* A real screenshot of the demo, not a mock-up — it is the same
              build the /demo route serves. */}
          <img
            src="/marketing/app-home.png"
            alt="The YouInc home screen: one line on how the month is going, then net worth, cash, monthly spend and runway, with anything that needs attention below."
            width={1360}
            height={860}
            loading="lazy"
          />
        </section>

        <section className="ph-block" aria-labelledby="ph-demo-heading">
          <h2 id="ph-demo-heading">Have a look first</h2>
          <p>
            The demo is the application itself, running on a seeded ledger
            instead of your accounts. Every screen is there and nothing is
            locked. When you reach the accounts screen it'll tell you how to get
            your own copy running, because that's the point at which the sample
            data stops being interesting.
          </p>
          <Link className="ph-link" to="/demo">
            Open the demo →
          </Link>
        </section>

        <section className="ph-block" aria-labelledby="ph-inside-heading">
          <h2 id="ph-inside-heading">What's inside</h2>
          <div className="ph-grid">
            {INSIDE.map((part) => (
              <article className="ph-card" key={part.title}>
                <h3>{part.title}</h3>
                <p>{part.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="ph-block" aria-labelledby="ph-install-heading">
          <h2 id="ph-install-heading">Running your own copy</h2>
          <p>
            Today that means cloning the repository and bringing up Postgres
            through Supabase — the steps are in the docs, and it takes a
            terminal and about ten minutes. Packaging it so you can download one
            thing and run it is the next piece of work; a container image is the
            likely first step.
          </p>
          <p className="ph-block__aside">
            Until then the setup is genuinely a barrier, and it's worth saying so
            rather than pretending otherwise.
          </p>
          <div className="ph-hero__actions">
            <Link className="mk-btn mk-btn--ghost" to="/docs">
              <span className="mk-btn__label">Read the docs</span>
            </Link>
            <a
              className="mk-btn mk-btn--ghost"
              href={SOURCE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="mk-btn__label">Setup guide</span>
            </a>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
