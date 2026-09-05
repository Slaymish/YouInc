import { createFileRoute, useLoaderData, Link } from '@tanstack/react-router';
import { HomeSummary } from '~/components/home/HomeSummary';
import { workspaceStage } from '~/server/workspaceStage';
import '~/components/home/home.css';
export const Route = createFileRoute('/app/')({component: AppHome});
function AppHome() {
  const {account,ledger,dashboard} = useLoaderData({from:'/app'});
  const empty = workspaceStage({accountCount:ledger.totals.accountCount,hasJournalBalances:ledger.hasJournalBalances}) === 'empty';
  return <>
    <HomeSummary dashboard={dashboard} subtitle={account.workspace!.name}/>
    {empty ? <section className="ws-firstrun" aria-labelledby="ws-firstrun-heading">
      <div className="ws-firstrun__head"><h2 id="ws-firstrun-heading">Get started</h2><p>Your dashboard is ready. Add the information you want to track.</p></div>
      <ol className="ws-firstrun__steps">
        <li className="ws-firstrun__step"><h3>Add your balances</h3><p>Add savings, investments or debt to see your net worth.</p>
          <Link className="auth-primary" to="/app/accounts" hash="manual">Add an account →</Link></li>
        <li className="ws-firstrun__step"><h3>Record income or spending</h3><p>Enter a transaction and give it a category. No bank connection is needed.</p>
          <Link className="auth-secondary" to="/app/activity">Add a transaction →</Link></li>
        <li className="ws-firstrun__step"><h3>Explore the demo</h3><p>See a populated dashboard using sample data, without adding it to your own ledger.</p>
          <Link className="auth-secondary" to="/demo">Open the demo →</Link></li>
      </ol>
    </section> : null}
  </>;
}
