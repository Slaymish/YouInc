import { createFileRoute, useLoaderData, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { AkahuConnectPanel } from "~/components/workspace/AkahuConnectPanel";
import { RulesEditor } from "~/components/workspace/RulesEditor";
import { AccountMappingEditor } from "~/components/workspace/AccountMappingEditor";
import { SyncHistoryPanel } from "~/components/workspace/SyncHistoryPanel";
import { useScrollSpy } from "~/hooks/useScrollSpy";
import { workspaceStage } from "~/server/workspaceStage";

export const Route = createFileRoute("/workspace/settings")({
  component: WorkspaceSettings,
});

const SECTIONS = [
  { id: "bank", label: "Bank" },
  { id: "sync", label: "Sync history" },
  { id: "mappings", label: "Account mappings" },
  { id: "rules", label: "Classification rules" },
] as const;

function WorkspaceSettings() {
  const { ledger, akahu, rules, accountMappings, syncLog } = useLoaderData({
    from: "/workspace",
  });
  const router = useRouter();
  const [syncRefreshToken, setSyncRefreshToken] = useState(0);
  const activeId = useScrollSpy(SECTIONS.map((s) => s.id));

  const stage = workspaceStage({
    accountCount: ledger.totals.accountCount,
    hasJournalBalances: ledger.hasJournalBalances,
  });
  const notConfigured = stage === "empty";

  return (
    <main className="ws-main ws-settings">
      <nav className="ws-subnav" aria-label="Settings sections">
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
        <section id="bank" className="ws-panel" aria-labelledby="ws-akahu-heading">
          <div className="ws-panel__head">
            <h2 id="ws-akahu-heading">Connect your bank</h2>
          </div>
          <div className="ws-panel__body">
            <AkahuConnectPanel
              status={akahu}
              onLedgerChange={() => {
                void router.invalidate();
              }}
              onSynced={() => {
                setSyncRefreshToken((n) => n + 1);
                void router.invalidate();
              }}
            />
          </div>
        </section>

        <section
          id="sync"
          className="ws-panel"
          aria-labelledby="ws-sync-history-heading"
        >
          <div className="ws-panel__head">
            <h2 id="ws-sync-history-heading">Sync history</h2>
          </div>
          <div className="ws-panel__body">
            <SyncHistoryPanel
              initialEntries={syncLog}
              refreshToken={syncRefreshToken}
            />
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
            <h2 id="ws-rules-heading">Classification rules</h2>
          </div>
          <div className="ws-panel__body">
            {notConfigured ? (
              <p className="ws-panel__defer">
                Classification rules categorize transactions as they sync.
                They're most useful once transactions are flowing in — connect a
                bank or load sample data first.
              </p>
            ) : null}
            <RulesEditor initialRules={rules} />
          </div>
        </section>
      </div>
    </main>
  );
}
