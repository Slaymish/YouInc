import { createFileRoute, useLoaderData, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { PageHeader } from '~/components/app/PageHeader';
const rename = createServerFn({method:'POST'}).validator((name: string) => name).handler(async ({data}) => {
  const {renameWorkspace} = await import('~/server/accounts'); await renameWorkspace(data);
});
const enableSync = createServerFn({method:'POST'}).handler(async () => {
  const {enableAkahu} = await import('~/server/akahuConnection'); await enableAkahu();
});
export const Route = createFileRoute('/app/settings')({component: SettingsPage});
function SettingsPage() {
  const {account} = useLoaderData({from:'/app'}); const router = useRouter();
  const [message,setMessage] = useState(''); const [busy,setBusy] = useState(false);
  return <>
    <PageHeader title="Settings" context="Your dashboard and your data, on this computer." />
    <section className="ws-panel"><div className="ws-panel__head"><h2>Your dashboard</h2></div>
      <form className="ws-panel__body transaction-form" onSubmit={async e => {
        e.preventDefault(); const name = String(new FormData(e.currentTarget).get('name')); setBusy(true);
        try {await rename({data:name}); await router.invalidate(); setMessage('Name saved.');}
        catch(error) {setMessage(error instanceof Error ? error.message : 'Could not save.');} finally {setBusy(false);}
      }}><label>Name<input name="name" defaultValue={account.workspace!.name} maxLength={120} required/></label>
        <button className="auth-primary" disabled={busy}>Save name</button><p role="status">{message}</p>
      </form>
    </section>
    <section className="ws-panel"><div className="ws-panel__head"><h2>Back up and export</h2></div>
      <div className="ws-panel__body transaction-form">
        <p>A database backup includes your transactions, account balances, rules and settings. Keep a copy somewhere separate from this computer.</p>
        <a className="app-chip" href="/api/backup">Download database backup</a>
        <a className="app-chip" href="/api/export">Export ledger journal</a>
        <p>The journal is a portable transaction export, not a full backup. Restore a database backup using the instructions in the README.</p>
      </div>
    </section>
    <section className="ws-panel"><div className="ws-panel__head"><h2>Optional bank sync</h2></div>
      <div className="ws-panel__body transaction-form"><p>After replacing a revoked Akahu token in your environment file and restarting, enable sync here.</p>
        <button className="app-chip" onClick={async () => {try {await enableSync(); await router.invalidate(); setMessage('Bank sync enabled if credentials are configured.');} catch {setMessage('Could not enable sync.');}}}>Enable configured bank sync</button>
      </div>
    </section>
  </>;
}
