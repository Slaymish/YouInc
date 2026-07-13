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
import { noop } from "~/components/marketing/noop";
import { useDarkTheme } from "~/components/marketing/system/useDarkTheme";
import { Atmosphere } from "~/components/marketing/system/Atmosphere";
import { MarketingHeader } from "~/components/marketing/shell/MarketingHeader";
import { MarketingFooter } from "~/components/marketing/shell/MarketingFooter";
import { breadcrumbList, jsonLdGraph, jsonLdScript } from "~/lib/seo";
import { SITE_URL } from "~/lib/sitemap";
import "~/components/dashboard/dashboard.css";
import "~/components/marketing/marketing-tokens.css";
import "~/components/marketing/system/base.css";
import "~/components/marketing/system/primitives.css";
import "~/components/marketing/marketing-shared.css";
import "~/components/marketing/widgets.css";

const WIDGETS_JSON_LD = jsonLdScript(
  jsonLdGraph([
    {
      "@type": "SoftwareApplication",
      name: "YouInc widget library",
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      description:
        "Every YouInc dashboard widget, rendered live on sample data — net worth, runway, cashflow, balance sheet, ledger controls, and more.",
      url: `${SITE_URL}/widgets`,
    },
    breadcrumbList(SITE_URL, [
      { name: "Home", path: "/" },
      { name: "Widget library", path: "/widgets" },
    ]),
  ]),
);

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
    scripts: [WIDGETS_JSON_LD],
  }),
  component: WidgetLibraryPage,
});

// Registry heights are dashboard row units; cap the tallest (balance sheet,
// journal) so catalogue panels stay browsable and scroll internally instead.
const MAX_LIVE_ROWS = 8;

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

function WidgetLibraryPage() {
  useDarkTheme();

  return (
    <div className="mk">
      <Atmosphere />
      <MarketingHeader />
      <main className="mk-content mk-page">
        <section className="wl-hero" aria-labelledby="wl-heading">
          <p className="mk-eyebrow">
            Widget library · rendered live on sample data
          </p>
          <h1 id="wl-heading" className="wl-hero__headline">
            Every widget, running <em>live.</em>
          </h1>
          <p className="wl-hero__sub">
            All {WIDGET_REGISTRY.length} dashboard widgets, rendered here on
            realistic sample data and sized the way they land on your board.
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
                {defs.map((def) => (
                  <LiveWidget def={def} key={def.id} />
                ))}
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
