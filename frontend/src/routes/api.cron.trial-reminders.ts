// POST /api/cron/trial-reminders — the day-12 trial-reminder trigger, called by
// the scheduled GitHub Actions workflow (.github/workflows/trial-reminders.yml).
//
// SECURITY: fails closed. If CRON_SECRET is unset the endpoint refuses ALL
// requests; otherwise it requires `Authorization: Bearer <CRON_SECRET>` and
// compares in constant time. No user session is involved — the work runs under
// the service role inside sendTrialReminders, which is why this gate is the only
// thing standing between the public internet and a cross-tenant job.
import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Length-checked constant-time compare (pure JS so this route stays client-
// bundle-safe — no node:crypto import at module scope).
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export const Route = createFileRoute("/api/cron/trial-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET?.trim();
        if (!secret) return json({ error: "cron not configured" }, 401);

        const header = request.headers.get("authorization") ?? "";
        const provided = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
        if (!provided || !safeEqual(provided, secret)) {
          return json({ error: "unauthorized" }, 401);
        }

        try {
          const { sendTrialReminders } = await import("~/server/trialReminders");
          const summary = await sendTrialReminders();
          return json({ ok: true, ...summary }, 200);
        } catch (err) {
          console.error("[cron] trial reminders failed", err);
          return json({ error: "reminder run failed" }, 500);
        }
      },
    },
  },
});
