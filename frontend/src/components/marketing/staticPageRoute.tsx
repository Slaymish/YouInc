import { breadcrumbList, jsonLdGraph, jsonLdScript, type JsonLdNode } from "~/lib/seo";
import { SITE_URL, toIsoDate } from "~/lib/sitemap";
import { StaticMarketingPage } from "./StaticMarketingPage";
import { pageData, type StaticPageData, type StaticPageId } from "./staticPages";

/** For the changelog page only: turn its date-titled sections ("5 July
 * 2026", "4 July 2026", ...) into `WebPageElement` nodes with a real
 * `dateModified`, so the per-entry update history is machine-readable too —
 * not just the page-level `dateModified`. Purely derived from existing
 * section titles; no copy is invented. */
function changelogParts(page: StaticPageData): readonly JsonLdNode[] | undefined {
  const parts = page.sections
    .map((section): JsonLdNode | null => {
      const iso = toIsoDate(section.title);
      return iso ? { "@type": "WebPageElement", name: section.title, dateModified: iso } : null;
    })
    .filter((part): part is JsonLdNode => part !== null);
  return parts.length > 0 ? parts : undefined;
}

function buildPageNode(id: StaticPageId, page: StaticPageData): JsonLdNode {
  const url = `${SITE_URL}/${id}`;
  const dateModified = toIsoDate(page.updated);

  if (page.schema?.kind === "FAQPage") {
    return {
      "@type": "FAQPage",
      name: page.heading,
      description: page.description,
      url,
      ...(dateModified ? { dateModified } : {}),
      mainEntity: page.schema.questions.map((entry) => ({
        "@type": "Question",
        name: entry.question,
        acceptedAnswer: { "@type": "Answer", text: entry.answer },
      })),
    };
  }

  const hasPart = id === "changelog" ? changelogParts(page) : undefined;
  return {
    "@type": "WebPage",
    name: page.heading,
    description: page.description,
    url,
    ...(dateModified ? { dateModified } : {}),
    ...(hasPart ? { hasPart } : {}),
  };
}

export function staticPageHead(id: StaticPageId) {
  const page = pageData(id);
  const pageNode = buildPageNode(id, page);
  const crumbs = breadcrumbList(SITE_URL, [
    { name: "Home", path: "/" },
    { name: page.eyebrow, path: `/${id}` },
  ]);
  return {
    meta: [
      { title: page.title },
      { name: "description", content: page.description },
    ],
    scripts: [jsonLdScript(jsonLdGraph([pageNode, crumbs]))],
  };
}

export function renderStaticPage(id: StaticPageId) {
  return function StaticPageRoute() {
    return <StaticMarketingPage id={id} />;
  };
}
