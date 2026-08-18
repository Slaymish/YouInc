import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { useEffect } from "react";
import { PageHeader } from "~/components/app/PageHeader";
import { SOURCE_URL } from "~/components/marketing/config";
import { trackProductEvent } from "~/lib/productAnalytics";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

/**
 * Your account, and the self-host pointer. Everything that used to live here
 * and isn't about you moved: the bank to Accounts, the ledger's machinery to
 * Workshop.
 */
function SettingsPage() {
  const { account } = useLoaderData({ from: "/app" });

  useEffect(() => {
    trackProductEvent("settings_opened");
  }, []);

  return (
    <>
      <PageHeader title="Settings" context="The account you're signed in with, and how to run your own copy." />

      <section className="ws-panel" aria-labelledby="ws-account-heading">
        <div className="ws-panel__head">
          <h2 id="ws-account-heading">Your account</h2>
        </div>
        <div className="ws-panel__body app-settings__row">
          <p>
            Signed in as <strong>{account.email ?? "this account"}</strong>
            {account.tenant ? ` · ${account.tenant.name}` : null}
          </p>
        </div>
      </section>

      <section className="ws-panel" aria-labelledby="ws-selfhost-heading">
        <div className="ws-panel__head">
          <h2 id="ws-selfhost-heading">Running your own instance</h2>
        </div>
        <div className="ws-panel__body app-settings__row">
          <p>YouInc is open source — the setup guide lives with the code.</p>
          <a
            className="app-chip"
            href={SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Read the docs →
          </a>
        </div>
      </section>
    </>
  );
}
