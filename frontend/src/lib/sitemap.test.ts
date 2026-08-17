import { describe, expect, it } from "vitest";
import { buildSitemapXml, PUBLIC_ROUTES, SITE_URL, toIsoDate } from "./sitemap";

describe("toIsoDate", () => {
  it("parses 'D Month YYYY' into ISO 8601", () => {
    expect(toIsoDate("5 July 2026")).toBe("2026-07-05");
    expect(toIsoDate("4 July 2026")).toBe("2026-07-04");
  });

  it("zero-pads single-digit days", () => {
    expect(toIsoDate("4 July 2026")).toBe("2026-07-04");
    expect(toIsoDate("31 December 2025")).toBe("2025-12-31");
  });

  it("returns undefined for missing or unparseable input", () => {
    expect(toIsoDate(undefined)).toBeUndefined();
    expect(toIsoDate("")).toBeUndefined();
    expect(toIsoDate("not a date")).toBeUndefined();
    expect(toIsoDate("2026-07-05")).toBeUndefined();
  });
});

describe("buildSitemapXml", () => {
  it("produces a well-formed urlset with an XML declaration", () => {
    const xml = buildSitemapXml(PUBLIC_ROUTES);
    expect(xml.startsWith("<?xml version=\"1.0\" encoding=\"UTF-8\"?>")).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml.trim().endsWith("</urlset>")).toBe(true);
  });

  it("emits exactly one <url> entry per route", () => {
    const xml = buildSitemapXml(PUBLIC_ROUTES);
    const urlCount = (xml.match(/<url>/g) ?? []).length;
    expect(urlCount).toBe(PUBLIC_ROUTES.length);
  });

  it("resolves <loc> against the provided base URL", () => {
    const xml = buildSitemapXml([{ path: "/demo" }], "https://example.test");
    expect(xml).toContain("<loc>https://example.test/demo</loc>");
  });

  it("defaults to the production SITE_URL when no base URL is given", () => {
    const xml = buildSitemapXml([{ path: "/demo" }]);
    expect(xml).toContain(`<loc>${SITE_URL}/demo</loc>`);
  });

  it("includes <lastmod> only when a parseable `updated` date is present", () => {
    const xml = buildSitemapXml([
      { path: "/security", updated: "5 July 2026" },
      { path: "/roadmap" },
    ]);
    expect(xml).toContain("<lastmod>2026-07-05</lastmod>");
    const roadmapBlock = xml.split("<url>")[2];
    expect(roadmapBlock).not.toContain("<lastmod>");
  });

  it("includes changefreq and a one-decimal priority when provided", () => {
    const xml = buildSitemapXml([
      { path: "/", changefreq: "weekly", priority: 1 },
    ]);
    expect(xml).toContain("<changefreq>weekly</changefreq>");
    expect(xml).toContain("<priority>1.0</priority>");
  });

  it("escapes XML-significant characters in the path", () => {
    const xml = buildSitemapXml([{ path: "/a&b" }], "https://example.test");
    expect(xml).toContain("<loc>https://example.test/a&amp;b</loc>");
  });

  it("never includes an excluded private route", () => {
    const privatePrefixes = ["/workspace", "/onboarding", "/admin", "/api/", "/auth/confirm"];
    for (const route of PUBLIC_ROUTES) {
      for (const prefix of privatePrefixes) {
        expect(route.path.startsWith(prefix)).toBe(false);
      }
    }
  });
});
