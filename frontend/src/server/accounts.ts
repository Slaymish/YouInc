import { setting, setSetting } from './database';
import { isDemoMode } from './localAccess';
export interface WorkspaceInfo { id: string; name: string; slug: string; defaultCurrency: string; }
export interface AccountState {
  workspace: WorkspaceInfo | null; bankConnected: boolean;
}
export async function getAccountState(): Promise<AccountState | null> {
  if (isDemoMode()) return null;
  return {
    workspace: { id: 'local', name: setting('name'), slug: 'local', defaultCurrency: setting('currency') },
    bankConnected: Boolean(process.env.AKAHU_APP_TOKEN && process.env.AKAHU_USER_TOKEN) };
}
export async function renameWorkspace(name: string): Promise<WorkspaceInfo> {
  const clean = name.trim();
  if (!clean || clean.length > 120) throw new Error('Enter a name of 1–120 characters.');
  setSetting('name', clean);
  return (await getAccountState())!.workspace!;
}
