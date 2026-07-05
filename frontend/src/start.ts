import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

// Defining a custom start.ts disables Start's automatic CSRF middleware, so it
// must be re-added explicitly to keep server functions protected. The legacy
// passkey session gate was removed with server/auth.ts — Supabase-gated routes
// enforce their own session inside their loaders (see routes/workspace.tsx).
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
}));
