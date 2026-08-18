import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "~/components/app/PageHeader";
import { WidgetBoard } from "~/components/app/WidgetBoard";
import { SPENDING_LAYOUT } from "~/components/app/pageLayouts";
import { SAMPLE_DASHBOARD } from "~/components/marketing/sampleDashboard";

export const Route = createFileRoute("/demo/spending")({
  component: DemoSpending,
});

function DemoSpending() {
  return (
    <>
      <PageHeader
        title="Spending"
        context="Where the money went, what repeats, and anything out of the ordinary."
      />
      <WidgetBoard placements={SPENDING_LAYOUT} dashboard={SAMPLE_DASHBOARD} />
    </>
  );
}
