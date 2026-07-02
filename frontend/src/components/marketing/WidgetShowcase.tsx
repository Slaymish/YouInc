import { Link } from "@tanstack/react-router";
import { WIDGET_MAP } from "../dashboard/widgets";
import { renderWidgetContent } from "../dashboard/renderWidget";
import { SAMPLE_DASHBOARD } from "./sampleDashboard";
import { SHOWCASE_WIDGET_IDS } from "./demoWidgets";
import { noop } from "./noop";

export function WidgetShowcase() {
  return (
    <section className="showcase" aria-labelledby="showcase-heading">
      <h2 id="showcase-heading" className="section-heading">
        Build your dashboard from any of these — or more.
      </h2>
      <div className="showcase__grid">
        {SHOWCASE_WIDGET_IDS.map((id, i) => (
          <div className={`showcase__card showcase__card--${i % 4}`} key={id}>
            <h3 className="showcase__label">{WIDGET_MAP.get(id)?.label ?? id}</h3>
            <div className="showcase__widget">{renderWidgetContent(id, SAMPLE_DASHBOARD, noop)}</div>
          </div>
        ))}
      </div>
      <Link className="mk-btn mk-btn--primary" to="/demo">
        Explore the full live demo →
      </Link>
    </section>
  );
}
