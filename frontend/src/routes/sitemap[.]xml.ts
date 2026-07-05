// GET /sitemap.xml — a dynamically generated sitemap covering every public
// marketing/content route. Excludes anything gated or non-canonical
// (/workspace, /onboarding, /admin/*, /api/*, /auth/confirm). The actual
// route list + XML-building logic lives in `~/lib/sitemap` so it can be unit
// tested without a running server (see `src/lib/sitemap.test.ts`).
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { buildSitemapXml, PUBLIC_ROUTES } = await import("~/lib/sitemap");
        const xml = buildSitemapXml(PUBLIC_ROUTES);
        return new Response(xml, {
          status: 200,
          headers: { "Content-Type": "application/xml; charset=utf-8" },
        });
      },
    },
  },
});
