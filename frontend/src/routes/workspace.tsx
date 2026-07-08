import {
  createFileRoute,
  redirect,
  useRouter,
  Link,
  Outlet,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useLightTheme } from "~/components/marketing/useLightTheme";
import { Logo } from "~/components/Logo";
import type { AccountState } from "~/server/accounts";
import type { WorkspaceLedgerSummary } from "~/server/workspaceLedger";
import type {
  AkahuConnectionStatus,
  AkahuSyncLogEntry,
} from "~/server/akahuConnection";
import type { ClassificationRule } from "~/server/tenantRules";
import type { AccountMapping } from "~/server/accountMappings";
import type { LedgerDashboardData } from "~/components/dashboard/dashboardData";
import "~/styles/auth.css";
import "~/styles/workspace.css";
import "~/components/dashboard/dashboard.css";

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
    if (!account || !account.tenant)
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
    const { listRules } = await import("~/server/tenantRules");
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

const signOutFn = createServerFn({ method: "POST" }).handler(async () => {
  const { signOutUser } = await import("~/server/accounts");
  await signOutUser();
});

export const Route = createFileRoute("/workspace")({
  loader: async (): Promise<WorkspaceLoaderData> => {
    const data = await loadWorkspace();
    if (!data.account) throw redirect({ to: "/signin" });
    if (!data.account.tenant) throw redirect({ to: "/onboarding" });
    return data as WorkspaceLoaderData;
  },
  component: WorkspaceLayout,
});

function WorkspaceLayout() {
  const { account } = Route.useLoaderData();
  const router = useRouter();
  useLightTheme();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      const { getSupabaseBrowserClient } = await import(
        "~/lib/supabaseBrowser"
      );
      await getSupabaseBrowserClient().auth.signOut();
      await signOutFn();
      await router.navigate({ to: "/" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ws-shell">
      <header className="ws-topbar">
        <Link className="ws-topbar__logo" to="/" aria-label="YouInc home">
          <Logo height={24} />
        </Link>
        <div className="ws-topbar__account">
          <span>{account.email}</span>
          <button
            className="ws-signout"
            type="button"
            onClick={signOut}
            disabled={busy}
          >
            Sign out
          </button>
        </div>
      </header>

      <nav className="ws-tabs" aria-label="Workspace sections">
        <Link
          className="ws-tab"
          to="/workspace"
          activeOptions={{ exact: true }}
          activeProps={{ className: "ws-tab ws-tab--active" }}
        >
          Overview
        </Link>
        <Link
          className="ws-tab"
          to="/workspace/settings"
          activeProps={{ className: "ws-tab ws-tab--active" }}
        >
          Settings
        </Link>
      </nav>

      <Outlet />
    </div>
  );
}
