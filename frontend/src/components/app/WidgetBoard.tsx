import type { LedgerDashboardData } from "~/components/dashboard/dashboardData";
import { WIDGET_MAP } from "~/components/dashboard/widgets";
import type { PagePlacement } from "./pageLayouts";
import { METRIC_IDS, renderWidgetContent } from "~/components/dashboard/renderWidget";

const ROW_HEIGHT = 80;

/**
 * The analysis pages' fixed board. Same markup and CSS as the pinboard grid —
 * `.dashboard-grid`, `.panel`, `.metric` — so every card looks and measures
 * exactly as it does there, without drag handles, resize grips or a picker.
 * These pages answer a question; laying them out isn't the reader's job.
 */
export function WidgetBoard({
  placements,
  dashboard,
}: {
  placements: readonly PagePlacement[];
  dashboard: LedgerDashboardData;
}) {
  return (
    <div
      className="dashboard-grid"
      style={{ "--row-height": `${ROW_HEIGHT}px` } as React.CSSProperties}
    >
      {placements.map((placement) => {
        const definition = WIDGET_MAP.get(placement.id);
        if (!definition) return null;
        const style: React.CSSProperties = {
          gridColumn: `${placement.x + 1} / span ${placement.w}`,
          gridRow: `${placement.y + 1} / span ${placement.h}`,
        };
        // Attention rows deep-link by view id, which these pages don't have —
        // Home is the only place that renders them, with real routes.
        const content = renderWidgetContent(placement.id, dashboard, () => {});

        if (METRIC_IDS.has(placement.id)) {
          return (
            <article
              key={placement.id}
              className={`metric widget--${placement.id}`}
              data-widget-id={placement.id}
              style={style}
            >
              {content}
            </article>
          );
        }

        return (
          <section
            key={placement.id}
            className={`panel widget--${placement.id}`}
            data-widget-id={placement.id}
            style={style}
          >
            <header>
              <h2>{definition.label}</h2>
            </header>
            <div className="panel-body">{content}</div>
          </section>
        );
      })}
    </div>
  );
}
