import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AppShell } from "~/components/app/AppShell";
import { RouteLoadDial } from "~/components/dashboard/RouteLoadDial";
import type { AccountState } from "~/server/accounts";
import type { WorkspaceLedgerSummary } from "~/server/workspaceLedger";
import type {
  AkahuConnectionStatus,
  AkahuSyncLogEntry,
} from "~/server/akahuConnection";
import type { ClassificationRule } from "~/server/rules";
import type { AccountMapping } from "~/server/accountMappings";
import type { LedgerDashboardData } from "~/components/dashboard/dashboardData";
import "~/styles/auth.css";
import "~/styles/workspace.css";
import "~/components/dashboard/dashboard.css";
import "~/components/marketing/marketing-tokens.css";

export interface WorkspaceLoaderData {
  account: AccountState;
  ledger: WorkspaceLedgerSummary;
  akahu: AkahuConnectionStatus;
  rules: ClassificationRule[];
  accountMappings: AccountMapping[];
  syncLog: AkahuSyncLogEntry[];
  dashboard: LedgerDashboardData;
}

const loadWorkspace = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    account: AccountState | null;
    ledger: WorkspaceLedgerSummary | null;
    akahu: AkahuConnectionStatus | null;
    rules: ClassificationRule[];
    accountMappings: AccountMapping[];
    syncLog: AkahuSyncLogEntry[];
    dashboard: LedgerDashboardData | null;
  }> => {
    const { getAccountState } = await import("~/server/accounts");
    const account = await getAccountState();
    if (!account || !account.workspace)
      return {
        account,
        ledger: null,
        akahu: null,
        rules: [],
        accountMappings: [],
        syncLog: [],
        dashboard: null,
      };
    const { getWorkspaceLedger } = await import("~/server/workspaceLedger");
    const { getAkahuConnectionStatus, listSyncLog } = await import(
      "~/server/akahuConnection"
    );
    const { listRules } = await import("~/server/rules");
    const { listAccountMappings } = await import("~/server/accountMappings");
    const { getWorkspaceDashboard } = await import(
      "~/server/workspaceDashboard"
    );
    const [ledger, akahu, rules, accountMappings, syncLog, dashboard] =
      await Promise.all([
        getWorkspaceLedger(),
        getAkahuConnectionStatus(),
        listRules(),
        listAccountMappings(),
        listSyncLog(),
        getWorkspaceDashboard(),
      ]);
    return { account, ledger, akahu, rules, accountMappings, syncLog, dashboard };
  },
);

export const Route = createFileRoute("/app")({
  loader: async (): Promise<WorkspaceLoaderData> => {
    const data = await loadWorkspace();
    if (!data.account) throw redirect({ to: "/demo" });
    if (!data.account.workspace) throw redirect({ to: "/onboarding" });
    return data as WorkspaceLoaderData;
  },
  component: AppLayout,
});

function AppLayout() {
  const { account } = Route.useLoaderData();
  return (
    <AppShell homeTo="/app" subtitle={account.workspace!.name}
      foot={<p className="app-sidebar__email">Stored on this computer</p>}>
      <RouteLoadDial label="Loading" />
      <Outlet />
    </AppShell>
  );
}
