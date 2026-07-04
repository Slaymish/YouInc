import type { CSSProperties } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  WIDGET_REGISTRY,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  type WidgetDefinition,
  type WidgetId,
} from "~/components/dashboard/widgets";
import {
  renderWidgetContent,
  METRIC_IDS,
} from "~/components/dashboard/renderWidget";
import { SAMPLE_DASHBOARD } from "~/components/marketing/sampleDashboard";
import { DEMO_WIDGET_IDS } from "~/components/marketing/demoWidgets";
import { noop } from "~/components/marketing/noop";
import { useLightTheme } from "~/components/marketing/useLightTheme";
import { MarketingHeader } from "~/components/marketing/MarketingHeader";
import { MarketingFooter } from "~/components/marketing/MarketingFooter";
import "~/components/dashboard/dashboard.css";
import "~/components/marketing/marketing-tokens.css";
import "~/components/marketing/marketing-shared.css";
import "~/components/marketing/widgets.css";

export const Route = createFileRoute("/widgets")({
  head: () => ({
    meta: [
      { title: "Widget library — YouInc" },
      {
        name: "description",
        content:
          "Every YouInc dashboard widget, rendered live on sample data — net worth, runway, cashflow, balance sheet, ledger controls, and more.",
      },
    ],
  }),
  component: WidgetLibraryPage,
});

const LIVE_IDS = new Set<WidgetId>(DEMO_WIDGET_IDS);

// The four widgets that trigger session-gated server mutations (see
// demoWidgets.ts) — shown as placeholders here, never live-rendered.
const GATED_DESCRIPTIONS: Partial<Record<WidgetId, string>> = {
  ingestion:
    "Trigger an Akahu sync and watch bank transactions post into your ledger.",
  "manual-accounts":
    "Track what banks can't see — KiwiSaver, property, vehicles — with manual balances.",
  "source-systems":
    "Map each connected account to the ledger and keep an eye on feed health.",
  "suspense-queue":
    "Clear transactions the classifier could not route by posting them to the right account.",
};

// Registry heights are dashboard row units; cap the tallest (balance sheet,
// journal) so catalogue panels stay browsable and scroll internally instead.
const MAX_LIVE_ROWS = 8;
const MAX_GATED_ROWS = 3;

// Catalogue-only size tweaks where a registry default clips content in a
// static, non-resizable panel: the liquidity list needs one extra column, the
// control brief one extra row, and the journal's sample data is short.
const CATALOGUE_SIZES: Partial<Record<WidgetId, { w?: number; h?: number }>> = {
  liquidity: { w: 3 },
  "control-brief": { h: 3 },
  journal: { h: 6 },
};

function itemStyle(w: number, h: number): CSSProperties {
  return { "--wl-w": w, "--wl-h": h } as CSSProperties;
}

function LiveWidget({ def }: { def: WidgetDefinition }) {
  const override = CATALOGUE_SIZES[def.id];
  const width = override?.w ?? def.defaultW;
  const style = itemStyle(
    width,
    Math.min(override?.h ?? def.defaultH, MAX_LIVE_ROWS),
  );
  const half = width <= 3;
  if (METRIC_IDS.has(def.id)) {
    return (
      <div
        className={`metric wl-item${half ? " wl-item--half" : ""}`}
        style={style}
      >
        {renderWidgetContent(def.id, SAMPLE_DASHBOARD, noop)}
      </div>
    );
  }
  return (
    <article
      className={`panel wl-item${half ? " wl-item--half" : ""}`}
      style={style}
    >
      <header>
        <h2>{def.label}</h2>
      </header>
      <div className="panel-body">
        {renderWidgetContent(def.id, SAMPLE_DASHBOARD, noop)}
      </div>
    </article>
  );
}

function GatedWidget({ def }: { def: WidgetDefinition }) {
  return (
    <article
      className="wl-item wl-locked"
      style={itemStyle(def.defaultW, Math.min(def.defaultH, MAX_GATED_ROWS))}
    >
      <header className="wl-locked__head">
        <h2 className="wl-locked__label">{def.label}</h2>
        <span className="wl-locked__tag">Connects to your live account</span>
      </header>
      <p className="wl-locked__desc">{GATED_DESCRIPTIONS[def.id]}</p>
    </article>
  );
}

function WidgetLibraryPage() {
  useLightTheme();
  const gatedCount = WIDGET_REGISTRY.length - DEMO_WIDGET_IDS.length;

  return (
    <div className="mk">
      <MarketingHeader />
      <main>
        <section className="wl-hero" aria-labelledby="wl-heading">
          <p className="mk-eyebrow">
            Widget library · rendered live on sample data
          </p>
          <h1 id="wl-heading" className="wl-hero__headline">
            Every widget, running <em>live.</em>
          </h1>
          <p className="wl-hero__sub">
            All {WIDGET_REGISTRY.length} dashboard widgets, rendered here on
            realistic sample data and sized the way they land on your board. The{" "}
            {gatedCount} that write to a real ledger wait until you connect an
            account.
          </p>
        </section>

        {CATEGORY_ORDER.map((cat) => {
          const defs = WIDGET_REGISTRY.filter((w) => w.category === cat);
          return (
            <section
              className="wl-cat"
              key={cat}
              aria-labelledby={`wl-cat-${cat}`}
            >
              <h2 id={`wl-cat-${cat}`} className="wl-cat__heading">
                {CATEGORY_LABELS[cat]}
                <span className="wl-cat__count">{defs.length}</span>
              </h2>
              <div className="wl-grid">
                {defs.map((def) =>
                  LIVE_IDS.has(def.id) ? (
                    <LiveWidget def={def} key={def.id} />
                  ) : (
                    <GatedWidget def={def} key={def.id} />
                  ),
                )}
              </div>
            </section>
          );
        })}

        <section className="wl-cta" aria-labelledby="wl-cta-heading">
          <h2 id="wl-cta-heading" className="section-heading">
            See the widgets arranged on a full board.
          </h2>
          <div className="wl-cta__row">
            <Link className="mk-btn mk-btn--primary" to="/demo">
              Try the live demo →
            </Link>
            <Link className="mk-btn mk-btn--ghost" to="/custom-builds">
              Missing one? I build it →
            </Link>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
