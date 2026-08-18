import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";

// The app moved from /workspace to /app ("workspace" was enterprise filler for
// "the app" — see the interface plan §05). Old bookmarks, docs links and the
// OAuth callbacks all keep working through this redirect. `workspace.$.tsx`
// exists purely so deeper paths still match and land here.
// The old Settings tab was mostly the bank connection, which now lives on
// Accounts; the ledger machinery it also held moved to Workshop.
const MOVED: Record<string, string> = {
  "/workspace/settings": "/app/accounts",
};

export const Route = createFileRoute("/workspace")({
  beforeLoad: ({ location }) => {
    const target = MOVED[location.pathname.replace(/\/$/, "")] ?? "/app";
    throw redirect({ to: target, search: location.search, replace: true });
  },
  component: () => <Outlet />,
});
