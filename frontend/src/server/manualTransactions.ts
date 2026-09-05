import { insertJournal, setting } from './database';
export interface ManualTransactionInput {
  id: string; date: string; description: string; account: string; category: string;
  amountCents: number; direction: 'expense' | 'income';
}
export async function addManualTransaction(input: ManualTransactionInput): Promise<void> {
  if (!/^[\da-f-]{36}$/i.test(input.id)) throw new Error('Invalid transaction identifier.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(Date.parse(input.date)) || new Date(input.date).toISOString().slice(0,10) !== input.date) throw new Error('Enter a valid date.');
  if (!input.description.trim() || input.description.length > 300) throw new Error('Enter a description of 1–300 characters.');
  if (!/^(Assets|Liabilities):[^\r\n]+$/.test(input.account) || input.account.length > 200) throw new Error('Choose an asset or liability account.');
  if (!['income','expense'].includes(input.direction)) throw new Error('Choose income or expense.');
  const prefix = input.direction === 'expense' ? 'Expenses:' : 'Income:';
  if (!input.category.startsWith(prefix) || !input.category.slice(prefix.length).trim() || /[\r\n]/.test(input.category) || input.category.length > 200) throw new Error(`Category must start with ${prefix}`);
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) throw new Error('Enter a positive amount with at most two decimal places.');
  const currency = setting('currency');
  insertJournal({externalId: `entry:${input.id}`, transactionDate: input.date,
    description: input.description.trim(), sourceAccountId: 'entered', status: 'posted', ruleId: 'manual:entry',
    postings: [
      {account: input.account.trim(), side: input.direction === 'income' ? 'debit' : 'credit', amountCents: input.amountCents, currency},
      {account: input.category.trim(), side: input.direction === 'income' ? 'credit' : 'debit', amountCents: input.amountCents, currency},
    ]});
}
