import { createFileRoute, redirect, useRouter, Outlet } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { clearAuthCache } from "~/lib/authCache";
import { AppShell } from "~/components/app/AppShell";
import { RouteLoadDial } from "~/components/dashboard/RouteLoadDial";
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

export const Route = createFileRoute("/app")({
  loader: async (): Promise<WorkspaceLoaderData> => {
    const data = await loadWorkspace();
    if (!data.account) throw redirect({ to: "/signin" });
    if (!data.account.tenant) throw redirect({ to: "/onboarding" });
    return data as WorkspaceLoaderData;
  },
  component: AppLayout,
});

function AppLayout() {
  const { account } = Route.useLoaderData();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const tenant = account.tenant!;

  async function signOut() {
    setBusy(true);
    // Cleared before the request, not after: a failed sign-out must not leave
    // the tab still caching "signed in".
    clearAuthCache();
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
    <AppShell
      homeTo="/app"
      subtitle={tenant.name}
      foot={
        <>
          <p className="app-sidebar__email" title={account.email ?? undefined}>
            {account.email ?? "Signed in"}
          </p>
          <button className="app-chip" type="button" onClick={signOut} disabled={busy}>
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </>
      }
    >
      <RouteLoadDial label="Loading" />
      <Outlet />
    </AppShell>
  );
}
