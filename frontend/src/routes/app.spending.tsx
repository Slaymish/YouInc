import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { PageHeader } from "~/components/app/PageHeader";
import { WidgetBoard } from "~/components/app/WidgetBoard";
import { SPENDING_LAYOUT } from "~/components/app/pageLayouts";

export const Route = createFileRoute("/app/spending")({
  component: SpendingPage,
});

function SpendingPage() {
  const { dashboard } = useLoaderData({ from: "/app" });

  return (
    <>
      <PageHeader
        title="Spending"
        context="Where the money went, what repeats, and anything out of the ordinary."
      />
      <WidgetBoard placements={SPENDING_LAYOUT} dashboard={dashboard} />
    </>
  );
}
