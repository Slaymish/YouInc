import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "~/components/app/PageHeader";
import { WidgetBoard } from "~/components/app/WidgetBoard";
import { ACCOUNTS_LAYOUT } from "~/components/app/pageLayouts";
import { InstallPrompt } from "~/components/demo/InstallPrompt";
import { SAMPLE_DASHBOARD } from "~/components/marketing/sampleDashboard";

export const Route = createFileRoute("/demo/accounts")({
  component: DemoAccounts,
});

function DemoAccounts() {
  return (
    <>
      <PageHeader
        title="Accounts"
        context="What's connected, what it's worth, and anything you track by hand."
      />
      <InstallPrompt />
      <WidgetBoard placements={ACCOUNTS_LAYOUT} dashboard={SAMPLE_DASHBOARD} />
    </>
  );
}
