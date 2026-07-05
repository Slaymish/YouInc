import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { MarketingPage } from "~/components/marketing/MarketingPage";

const checkSession = createServerFn({ method: "GET" }).handler(async () => {
  const { getServerUser } = await import("~/server/supabaseServer");
  return { authenticated: (await getServerUser()) !== null };
});

export const Route = createFileRoute("/")({
  loader: async () => {
    const { authenticated } = await checkSession();
    if (authenticated) {
      throw redirect({ to: "/workspace" });
    }
  },
  component: MarketingPage,
});
