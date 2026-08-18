import { createFileRoute, useLoaderData, useRouter } from "@tanstack/react-router";
import { PageHeader } from "~/components/app/PageHeader";
import { SortingTask } from "~/components/activity/SortingTask";
import { TransactionList } from "~/components/activity/TransactionList";

export const Route = createFileRoute("/app/activity")({
  component: ActivityPage,
});

/**
 * What happened, and the short list of things the rules couldn't place. The
 * sorting task comes first: it's the one thing on this page that needs a person,
 * and a clean ledger depends on it being quick.
 */
function ActivityPage() {
  const { dashboard } = useLoaderData({ from: "/app" });
  const router = useRouter();

  return (
    <>
      <PageHeader title="Activity" context="What happened, newest first." />

      <section className="ws-panel" aria-labelledby="ws-sorting-heading">
        <div className="ws-panel__head">
          <h2 id="ws-sorting-heading">Needs a category</h2>
        </div>
        <div className="ws-panel__body">
          <SortingTask
            dashboard={dashboard}
            onResolved={() => {
              void router.invalidate();
            }}
          />
        </div>
      </section>

      <section className="ws-panel" aria-labelledby="ws-transactions-heading">
        <div className="ws-panel__head">
          <h2 id="ws-transactions-heading">Transactions</h2>
        </div>
        <div className="ws-panel__body">
          <TransactionList dashboard={dashboard} />
        </div>
      </section>
    </>
  );
}
