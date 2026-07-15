import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/analytics")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const requestUrl = new URL(request.url);
          const origin = request.headers.get("origin");
          if (origin && origin !== requestUrl.origin) {
            return Response.json({ error: "Invalid analytics origin." }, { status: 403 });
          }
          const body = await request.text();
          if (new TextEncoder().encode(body).byteLength > 2_048) {
            return Response.json({ error: "Analytics event is too large." }, { status: 413 });
          }
          const input = JSON.parse(body);
          const { recordProductEvent } = await import("~/server/productAnalytics");
          await recordProductEvent(input);
          return new Response(null, { status: 204 });
        } catch (error) {
          const status = (error as { status?: number } | null)?.status ?? 400;
          return Response.json({ error: "Invalid analytics event." }, { status });
        }
      },
    },
  },
});
