import { breadcrumbList, jsonLdGraph, jsonLdScript, type JsonLdNode } from "~/lib/seo";
import { SITE_URL, toIsoDate } from "~/lib/sitemap";
import { StaticMarketingPage } from "./StaticMarketingPage";
import { pageData, type StaticPageData, type StaticPageId } from "./staticPages";

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

  return {
    "@type": "WebPage",
    name: page.heading,
    description: page.description,
    url,
    ...(dateModified ? { dateModified } : {}),
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
