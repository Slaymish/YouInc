// Shared schema.org / JSON-LD helpers used by route `head()` exports to build
// a knowledge-graph-style SEO/GEO surface (Organization, WebSite, per-page
// WebPage/FAQPage/Product nodes, BreadcrumbList, etc).
//
// Kept dependency-free (no `~/` imports) so it can be unit-tested under the
// standalone node vitest config, which does not load the app's path-alias or
// React plugins.

/** A single schema.org JSON-LD node. Loose by design — schema.org has
 * hundreds of types and this repo only needs a handful of them. */
export interface JsonLdNode {
  "@context"?: string;
  "@type"?: string;
  [key: string]: JsonLdValue;
}

export type JsonLdValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | JsonLdNode
  | readonly JsonLdValue[];

/** The shape TanStack Start's `head()` `scripts` array expects for a plain
 * inline `<script>` tag (see `React.JSX.IntrinsicElements['script']`). */
export interface ScriptHeadTag {
  type: string;
  children: string;
}

const LESS_THAN = /</g;

/**
 * Safely serialize one or more JSON-LD nodes for embedding inside an inline
 * `<script type="application/ld+json">` tag.
 *
 * `JSON.stringify` alone is not safe to drop into an HTML response: if any
 * string value in the data contains `</script` (or `<!--`), the browser's
 * HTML tokenizer treats it as the end of the script element (or the start of
 * a comment) *before* any JS/JSON parsing happens — regardless of how
 * well-formed the JSON is. That is a real injection vector whenever any
 * value ultimately traces back to user input.
 *
 * The fix: escape every `<` character to its unicode escape `<`. JSON
 * string escapes round-trip through `JSON.parse` back to a literal `<`, so
 * the data is unchanged, but the raw HTML byte stream emitted by the server
 * can never contain a `<` character from our payload — so `</script`,
 * `<!--`, and similar breakout sequences can never form.
 */
export function serializeJsonLd(
  data: JsonLdNode | readonly JsonLdNode[],
): string {
  return JSON.stringify(data).replace(LESS_THAN, "\\u003c");
}

/** Combine multiple top-level JSON-LD nodes into a single `@graph` document —
 * the standard way to describe several related, linked entities (e.g. a page
 * plus its breadcrumb trail) in one script tag. */
export function jsonLdGraph(nodes: readonly JsonLdNode[]): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@graph": nodes,
  };
}

/**
 * Build the `head().scripts` entry for one or more schema.org nodes. Pass a
 * fully-formed node (typically the result of `jsonLdGraph`, or a single node
 * that already carries its own `@context`).
 */
export function jsonLdScript(
  data: JsonLdNode | readonly JsonLdNode[],
): ScriptHeadTag {
  return {
    type: "application/ld+json",
    children: serializeJsonLd(data),
  };
}

/** A single crumb in a `BreadcrumbList`. */
export interface Breadcrumb {
  name: string;
  path: string;
}

/** Build a `BreadcrumbList` node reflecting a page's position in the site,
 * e.g. Home > Trust > Security. Paths are resolved against `baseUrl`. */
export function breadcrumbList(
  baseUrl: string,
  crumbs: readonly Breadcrumb[],
): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: `${baseUrl}${crumb.path}`,
    })),
  };
}
