import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "~/components/app/PageHeader";
import { WidgetBoard } from "~/components/app/WidgetBoard";
import { NET_WORTH_LAYOUT } from "~/components/app/pageLayouts";
import { SAMPLE_DASHBOARD } from "~/components/marketing/sampleDashboard";

export const Route = createFileRoute("/demo/net-worth")({
  component: DemoNetWorth,
});

function DemoNetWorth() {
  return (
    <>
      <PageHeader
        title="Net worth"
        context="What you own against what you owe, and which way it's moving."
      />
      <WidgetBoard placements={NET_WORTH_LAYOUT} dashboard={SAMPLE_DASHBOARD} />
    </>
  );
}
