import { useState } from 'react';
import { createServerFn } from '@tanstack/react-start';
import { useRouter } from '@tanstack/react-router';
import type { ManualTransactionInput } from '~/server/manualTransactions';
const save = createServerFn({method: 'POST'}).validator((input: ManualTransactionInput) => input)
  .handler(async ({data}) => { const {addManualTransaction} = await import('~/server/manualTransactions'); return addManualTransaction(data); });
export function AddTransaction({accounts = []}: {accounts?: string[]}) {
  const router = useRouter();
  const [id, setId] = useState<string | null>(null);
  const [direction, setDirection] = useState<'expense'|'income'>('expense');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return <section className="ws-panel">
    <div className="ws-panel__head"><h2>Add a transaction</h2></div>
    <form className="ws-panel__body transaction-form" onSubmit={async event => {
      event.preventDefault(); const form = event.currentTarget;
      const values = new FormData(form); const requestId = id ?? crypto.randomUUID(); setId(requestId);
      setBusy(true); setMessage('');
      try {
        const amount = String(values.get('amount'));
        if (!/^\d+(\.\d{1,2})?$/.test(amount)) throw new Error('Enter an amount with at most two decimal places.');
        await save({data: {id: requestId, direction, date: String(values.get('date')),
          description: String(values.get('description')), account: String(values.get('account')),
          category: `${direction === 'expense' ? 'Expenses' : 'Income'}:${String(values.get('category')).trim()}`,
          amountCents: Math.round(Number(amount)*100)}});
        setId(null); form.reset(); setMessage('Transaction saved.'); await router.invalidate();
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save transaction.'); }
      finally { setBusy(false); }
    }}>
      <label>Type<select value={direction} onChange={e => {setDirection(e.target.value as 'expense'|'income'); setId(null);}} disabled={busy}>
        <option value="expense">Expense</option><option value="income">Income</option>
      </select></label>
      <label>Date<input name="date" type="date" defaultValue={new Date().toISOString().slice(0,10)} required disabled={busy}/></label>
      <label>Description<input name="description" maxLength={300} required disabled={busy}/></label>
      <label>Amount (NZD)<input name="amount" type="number" min="0.01" step="0.01" required disabled={busy}/></label>
      <label>Account<select name="account" disabled={busy}>
        {[...new Set(['Assets:Bank:Everyday', ...accounts])].map(account =>
          <option key={account} value={account}>{account.split(':').slice(1).join(' · ')}</option>)}
      </select></label>
      <label>Category<input name="category" placeholder={direction === 'expense' ? 'Groceries' : 'Salary'} required disabled={busy}/></label>
      <p>These entries update your ledger. A manually maintained account balance takes precedence over its transaction total.</p>
      <button className="auth-primary" disabled={busy}>{busy ? 'Saving…' : 'Save transaction'}</button>
      <p role="status">{message}</p>
    </form>
  </section>;
}
