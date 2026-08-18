import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { PageHeader } from "~/components/app/PageHeader";
import { WidgetBoard } from "~/components/app/WidgetBoard";
import { NET_WORTH_LAYOUT } from "~/components/app/pageLayouts";

export const Route = createFileRoute("/app/net-worth")({
  component: NetWorthPage,
});

function NetWorthPage() {
  const { dashboard } = useLoaderData({ from: "/app" });

  return (
    <>
      <PageHeader
        title="Net worth"
        context="What you own against what you owe, and which way it's moving."
      />
      <WidgetBoard placements={NET_WORTH_LAYOUT} dashboard={dashboard} />
    </>
  );
}
