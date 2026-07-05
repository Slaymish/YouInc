// Pure data + XML-building logic for the generated /sitemap.xml. Kept
// dependency-free (no `~/` imports) so it is unit-testable under the
// standalone node vitest config. The route route file
// (`src/routes/sitemap[.]xml.ts`) just calls `buildSitemapXml(PUBLIC_ROUTES,
// SITE_URL)` and returns the string as an XML response.

export const SITE_URL = "https://youinc.hamishburke.dev";

export interface SitemapRoute {
  /** Site-relative path, e.g. "/" or "/pricing". */
  path: string;
  /** Human-readable last-modified date as it appears in on-page copy, e.g.
   * "5 July 2026". Optional — omitted for pages with no maintained date. */
  updated?: string;
  changefreq?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority?: number;
}

// The full public marketing/content surface. Deliberately excludes anything
// gated or non-canonical: /workspace, /onboarding, /admin/*, /api/*, and
// /auth/confirm (a redirect-only callback route with no content of its own).
export const PUBLIC_ROUTES: readonly SitemapRoute[] = [
  { path: "/", changefreq: "weekly", priority: 1.0 },
  { path: "/demo", changefreq: "monthly", priority: 0.9 },
  { path: "/pricing", changefreq: "monthly", priority: 0.9 },
  { path: "/signup", changefreq: "monthly", priority: 0.8 },
  { path: "/signin", changefreq: "yearly", priority: 0.3 },
  { path: "/widgets", changefreq: "monthly", priority: 0.7 },
  { path: "/custom-builds", changefreq: "monthly", priority: 0.7 },
  { path: "/docs", changefreq: "monthly", priority: 0.7 },
  { path: "/help", changefreq: "monthly", priority: 0.6 },
  { path: "/integrations", changefreq: "monthly", priority: 0.6 },
  { path: "/use-cases", changefreq: "monthly", priority: 0.6 },
  { path: "/compare", changefreq: "monthly", priority: 0.6 },
  { path: "/about", changefreq: "monthly", priority: 0.5 },
  { path: "/changelog", updated: "5 July 2026", changefreq: "weekly", priority: 0.5 },
  { path: "/roadmap", changefreq: "monthly", priority: 0.4 },
  { path: "/security", updated: "5 July 2026", changefreq: "monthly", priority: 0.5 },
  { path: "/privacy", updated: "4 July 2026", changefreq: "monthly", priority: 0.4 },
  { path: "/terms", updated: "4 July 2026", changefreq: "monthly", priority: 0.4 },
  { path: "/data-deletion", updated: "4 July 2026", changefreq: "monthly", priority: 0.4 },
  { path: "/status", changefreq: "daily", priority: 0.3 },
  { path: "/contact", changefreq: "yearly", priority: 0.3 },
];

const MONTHS: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

/**
 * Parse the human-readable "D Month YYYY" dates already used in on-page copy
 * (e.g. "5 July 2026") into an ISO 8601 date ("2026-07-05") suitable for a
 * sitemap `<lastmod>`. Returns `undefined` for anything that doesn't match,
 * rather than guessing.
 */
export function toIsoDate(humanDate: string | undefined): string | undefined {
  if (!humanDate) return undefined;
  const match = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(humanDate.trim());
  if (!match) return undefined;
  const [, day, monthName, year] = match;
  const month = MONTHS[monthName.toLowerCase()];
  if (!month) return undefined;
  return `${year}-${month}-${day.padStart(2, "0")}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Build the full `<urlset>` XML document for a set of public routes. */
export function buildSitemapXml(
  routes: readonly SitemapRoute[],
  baseUrl: string = SITE_URL,
): string {
  const urls = routes
    .map((route) => {
      const loc = escapeXml(`${baseUrl}${route.path}`);
      const lastmod = toIsoDate(route.updated);
      const parts = [`    <loc>${loc}</loc>`];
      if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
      if (route.changefreq) parts.push(`    <changefreq>${route.changefreq}</changefreq>`);
      if (route.priority !== undefined) parts.push(`    <priority>${route.priority.toFixed(1)}</priority>`);
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
