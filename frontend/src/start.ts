import { createCsrfMiddleware, createStart, createMiddleware } from '@tanstack/react-start';
import { allowLocalRequest, isDemoMode } from './server/localAccess';
const localOnly = createMiddleware().server(async ({ request, next }) => {
  if (!isDemoMode() && !allowLocalRequest(request.url, request.headers.get('origin'))) {
    return new Response('YouInc personal mode only accepts requests from localhost.', { status: 403 });
  }
  return next();
});
const csrf = createCsrfMiddleware({ filter: ctx => ctx.handlerType === 'serverFn' });
export const startInstance = createStart(() => ({ requestMiddleware: [localOnly, csrf] }));
