import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { useEffect } from "react";
import { PageHeader } from "~/components/app/PageHeader";
import { RulesEditor } from "~/components/workspace/RulesEditor";
import { AccountMappingEditor } from "~/components/workspace/AccountMappingEditor";
import { SyncHistoryPanel } from "~/components/workspace/SyncHistoryPanel";
import { useScrollSpy } from "~/hooks/useScrollSpy";
import { workspaceStage } from "~/server/workspaceStage";
import { trackProductEvent } from "~/lib/productAnalytics";

export const Route = createFileRoute("/app/workshop")({
  component: Workshop,
});

const SECTIONS = [
  { id: "sync", label: "Sync log" },
  { id: "mappings", label: "Account mappings" },
  { id: "rules", label: "Sorting rules" },
] as const;

/**
 * The workshop: the ledger's machinery, opt-in and deliberately technical.
 * Nothing in the everyday layer links here except when something is genuinely
 * broken — see the interface plan §03.
 */
function Workshop() {
  const { ledger, rules, accountMappings, syncLog } = useLoaderData({
    from: "/app",
  });
  const activeId = useScrollSpy(SECTIONS.map((s) => s.id));

  useEffect(() => {
    trackProductEvent("settings_opened");
  }, []);

  const stage = workspaceStage({
    accountCount: ledger.totals.accountCount,
    hasJournalBalances: ledger.hasJournalBalances,
  });
  const notConfigured = stage === "empty";

  return (
    <>
      <PageHeader
        title="Workshop"
        context="How transactions get sorted, and what happened when they synced. You never have to come here."
      />

      <nav className="ws-subnav" aria-label="Workshop sections">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={
              "ws-subnav__link" +
              (activeId === s.id ? " ws-subnav__link--active" : "")
            }
            aria-current={activeId === s.id ? "true" : undefined}
          >
            {s.label}
          </a>
        ))}
      </nav>

      <div className="ws-settings__body">
        <section
          id="sync"
          className="ws-panel"
          aria-labelledby="ws-sync-history-heading"
        >
          <div className="ws-panel__head">
            <h2 id="ws-sync-history-heading">Sync log</h2>
          </div>
          <div className="ws-panel__body">
            <SyncHistoryPanel initialEntries={syncLog} />
          </div>
        </section>

        <section
          id="mappings"
          className="ws-panel"
          aria-labelledby="ws-account-mappings-heading"
        >
          <div className="ws-panel__head">
            <h2 id="ws-account-mappings-heading">Account mappings</h2>
          </div>
          <div className="ws-panel__body">
            {notConfigured ? (
              <p className="ws-panel__defer">
                Account mappings route incoming transactions to ledger accounts.
                You'll set these up once you've connected a bank or loaded
                sample data — the defaults handle most cases automatically.
              </p>
            ) : null}
            <AccountMappingEditor initialMappings={accountMappings} />
          </div>
        </section>

        <section id="rules" className="ws-panel" aria-labelledby="ws-rules-heading">
          <div className="ws-panel__head">
            <h2 id="ws-rules-heading">Sorting rules</h2>
          </div>
          <div className="ws-panel__body">
            {notConfigured ? (
              <p className="ws-panel__defer">
                Sorting rules decide which category a transaction lands in as
                it syncs. They're most useful once transactions are flowing in —
                connect a bank or load sample data first.
              </p>
            ) : null}
            <RulesEditor initialRules={rules} />
          </div>
        </section>
      </div>
    </>
  );
}
