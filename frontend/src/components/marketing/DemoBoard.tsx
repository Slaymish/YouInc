import { useEffect } from "react";
import { WIDGET_MAP, type WidgetId } from "../dashboard/widgets";
import { renderWidgetContent } from "../dashboard/renderWidget";
import { SAMPLE_DASHBOARD } from "./sampleDashboard";
import { DEMO_WIDGET_IDS } from "./demoWidgets";
import { noop } from "./noop";

/** Forces light theme while mounted so widget tokens stay consistent on public pages. */
export function useLightTheme() {
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.getAttribute("data-theme");
    html.setAttribute("data-theme", "light");
    return () => {
      if (prev) html.setAttribute("data-theme", prev);
      else html.removeAttribute("data-theme");
    };
  }, []);
}

export function DemoBoard({ ids = DEMO_WIDGET_IDS }: { ids?: WidgetId[] }) {
  return (
    <div className="demo-board">
      {ids.map((id) => (
        <section className="demo-panel" key={id}>
          <h3 className="demo-panel__title">{WIDGET_MAP.get(id)?.label ?? id}</h3>
          <div className="demo-panel__body">
            {renderWidgetContent(id, SAMPLE_DASHBOARD, noop)}
          </div>
        </section>
      ))}
    </div>
  );
}
