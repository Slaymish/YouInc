import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "~/components/app/PageHeader";
import { SortingTask } from "~/components/activity/SortingTask";
import { TransactionList } from "~/components/activity/TransactionList";
import { SAMPLE_DASHBOARD } from "~/components/marketing/sampleDashboard";

export const Route = createFileRoute("/demo/activity")({
  component: DemoActivity,
});

function DemoActivity() {
  return (
    <>
      <PageHeader title="Activity" context="What happened, newest first." />

      <section className="ws-panel" aria-labelledby="ws-sorting-heading">
        <div className="ws-panel__head">
          <h2 id="ws-sorting-heading">Needs a category</h2>
        </div>
        <div className="ws-panel__body">
          {/* Sorting works here — it just isn't written anywhere, because there
              is no ledger behind the demo. */}
          <SortingTask dashboard={SAMPLE_DASHBOARD} persist={false} />
        </div>
      </section>

      <section className="ws-panel" aria-labelledby="ws-transactions-heading">
        <div className="ws-panel__head">
          <h2 id="ws-transactions-heading">Transactions</h2>
        </div>
        <div className="ws-panel__body">
          <TransactionList dashboard={SAMPLE_DASHBOARD} />
        </div>
      </section>
    </>
  );
}
