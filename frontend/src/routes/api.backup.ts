import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/api/backup')({server: {handlers: {GET: async () => {
  const {isDemoMode} = await import('~/server/localAccess');
  if (isDemoMode()) return new Response('Personal data is unavailable in demo mode.', {status:403});
  const {backupDatabase} = await import('~/server/dataExport');
  return new Response(new Uint8Array(await backupDatabase()).buffer, {headers: {'Content-Type':'application/octet-stream',
    'Content-Disposition': 'attachment; filename="youinc-backup.sqlite3"', 'Cache-Control':'no-store'}});
}}}});
