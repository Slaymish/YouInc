import { createFileRoute, useLoaderData, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/components/app/PageHeader";
import { WidgetBoard } from "~/components/app/WidgetBoard";
import { ACCOUNTS_LAYOUT } from "~/components/app/pageLayouts";
import { AkahuConnectPanel } from "~/components/workspace/AkahuConnectPanel";
import { ManualBalancesEditor } from "~/components/workspace/ManualBalancesEditor";
import type { WorkspaceLedgerSummary } from "~/server/workspaceLedger";

export const Route = createFileRoute("/app/accounts")({
  component: AccountsPage,
});

/**
 * Every place money sits, in one list — synced and hand-entered together. The
 * old split (manual balances on the dashboard, the bank on Settings) mirrored
 * the persistence layer, not the way anyone thinks about their accounts.
 */
function AccountsPage() {
  const { ledger: initialLedger, akahu, dashboard } = useLoaderData({ from: "/app" });
  const router = useRouter();
  const [ledger, setLedger] = useState(initialLedger);

  // Local state gives instant feedback; invalidating the layout loader keeps
  // every other page's figures consistent.
  function handleLedgerChange(next: WorkspaceLedgerSummary) {
    setLedger(next);
    void router.invalidate();
  }

  return (
    <>
      <PageHeader
        title="Accounts"
        context="What's connected, what it's worth, and anything you track by hand."
      />

      <section id="bank" className="ws-panel" aria-labelledby="ws-akahu-heading">
        <div className="ws-panel__head">
          <h2 id="ws-akahu-heading">Your bank</h2>
        </div>
        <div className="ws-panel__body">
          <AkahuConnectPanel
            status={akahu}
            onLedgerChange={() => {
              void router.invalidate();
            }}
            onSynced={() => {
              void router.invalidate();
            }}
          />
        </div>
      </section>

      <section id="manual" className="ws-panel" aria-labelledby="ws-accounts-heading">
        <div className="ws-panel__head">
          <h2 id="ws-accounts-heading">Your accounts</h2>
        </div>
        <ManualBalancesEditor summary={ledger} onChange={handleLedgerChange} />
      </section>

      <WidgetBoard placements={ACCOUNTS_LAYOUT} dashboard={dashboard} />
    </>
  );
}
