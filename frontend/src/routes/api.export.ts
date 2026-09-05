import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/api/export')({server: {handlers: {GET: async () => {
  const {isDemoMode} = await import('~/server/localAccess');
  if (isDemoMode()) return new Response('Personal data is unavailable in demo mode.', {status:403});
  const {exportJournal} = await import('~/server/dataExport');
  return new Response(exportJournal(), {headers: {'Content-Type':'text/plain; charset=utf-8',
    'Content-Disposition': 'attachment; filename="youinc.journal"', 'Cache-Control':'no-store'}});
}}}});
