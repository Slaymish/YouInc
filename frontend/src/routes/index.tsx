import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ProjectHome } from "~/components/marketing/ProjectHome";
import { PRODUCT } from "~/components/marketing/config";
import { breadcrumbList, jsonLdGraph, jsonLdScript } from "~/lib/seo";
import { SITE_URL } from "~/lib/sitemap";

const checkSession = createServerFn({ method: "GET" }).handler(async () => {
  const { getServerUser } = await import("~/server/supabaseServer");
  return { authenticated: (await getServerUser()) !== null };
});

const HOME_JSON_LD = jsonLdScript(
  jsonLdGraph([
    {
      "@type": "WebPage",
      name: PRODUCT.heroHeadline,
      description: PRODUCT.heroSub,
      url: SITE_URL,
    },
    breadcrumbList(SITE_URL, [{ name: "Home", path: "/" }]),
  ]),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "YouInc — a ledger for your own money" },
      { name: "description", content: PRODUCT.heroSub },
    ],
    scripts: [HOME_JSON_LD],
  }),
  loader: async () => {
    const { authenticated } = await checkSession();
    if (authenticated) {
      throw redirect({ to: "/app" });
    }
  },
  component: ProjectHome,
});
