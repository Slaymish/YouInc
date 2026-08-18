import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { PageHeader } from "~/components/app/PageHeader";
import { Hint } from "~/components/ui/Hint";
import { DashboardGrid } from "~/components/dashboard/DashboardGrid";
import { WORKSPACE_WIDGET_IDS } from "~/components/workspace/workspaceWidgetIds";

export const Route = createFileRoute("/app/pinboard")({
  component: PinboardPage,
});

/**
 * The grid, renamed and demoted from front door to one page. It starts empty:
 * customisation used to mean "lay out your own app" — work you did before
 * getting an answer — and as a pinboard it means "collect what you care about",
 * which is a feature.
 */
function PinboardPage() {
  const { account, dashboard } = useLoaderData({ from: "/app" });
  const tenant = account.tenant!;

  return (
    <>
      <PageHeader
        title="Pinboard"
        context="Add the cards you want to keep an eye on. Nothing here is required."
      />
      <Hint hintKey="pinboard-customise">
        Press <strong>Customise</strong> to add cards. Anything on Spending or
        Net worth can live here too, so the things you check often are in one
        place.
      </Hint>
      <DashboardGrid
        dashboard={dashboard}
        storageKey={`youinc.workspace.layout.v3.${tenant.id}`}
        allowedWidgetIds={WORKSPACE_WIDGET_IDS}
      />
    </>
  );
}
