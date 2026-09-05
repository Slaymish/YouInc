import {test,expect} from '@playwright/test';
import {DatabaseSync} from 'node:sqlite';

test('local dashboard records a transaction, persists it, and exports a recoverable backup', async ({page,request}) => {
  await page.goto('/'); await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText('Stored on this computer')).toBeVisible();
  await page.goto('/app/activity');
  await page.getByLabel('Description',{exact:true}).fill('Browser test lunch');
  await page.getByLabel('Amount (NZD)',{exact:true}).fill('12.50');
  await page.getByLabel('Category',{exact:true}).fill('Food');
  await page.getByRole('button',{name:'Save transaction',exact:true}).click();
  await expect(page.getByText('Transaction saved.',{exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByText('Browser test lunch',{exact:true}).first()).toBeVisible();
  await page.goto('/app/settings');
  await page.getByLabel('Name',{exact:true}).fill('My local dashboard');
  await page.getByRole('button',{name:'Save name'}).click();
  await expect(page.getByText('Name saved.',{exact:true})).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:'Download database backup'}).click()]);
  const path=await download.path(); expect(path).toBeTruthy();
  const db=new DatabaseSync(path!,{readOnly:true});
  expect(db.prepare('SELECT value FROM settings WHERE key=?').get('name')?.value).toBe('My local dashboard');
  expect(db.prepare('SELECT COUNT(*) AS n FROM journal_transactions').get()?.n).toBe(1); db.close();
  const exported=await request.get('/api/export'); expect(exported.status()).toBe(200);
  expect(await exported.text()).toContain('Expenses:Food  12.50 NZD');
  await page.screenshot({path:'/tmp/youinc-settings.png',fullPage:true});
});
test('foreign host and origin cannot reach personal data',async ({request}) => {
  expect((await request.get('/api/backup',{headers:{Host:'attacker.example'}})).status()).toBe(403);
  expect((await request.get('/api/backup',{headers:{Origin:'https://attacker.example'}})).status()).toBe(403);
});
