import { createFileRoute } from "@tanstack/react-router";
import { HomeSummary } from "~/components/home/HomeSummary";
import { SAMPLE_DASHBOARD } from "~/components/marketing/sampleDashboard";

export const Route = createFileRoute("/demo/")({
  component: DemoHome,
});

function DemoHome() {
  return <HomeSummary dashboard={SAMPLE_DASHBOARD} subtitle="Sample data" base="/demo" />;
}
