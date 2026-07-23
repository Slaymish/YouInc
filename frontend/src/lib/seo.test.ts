import { describe, expect, it } from "vitest";
import {
  breadcrumbList,
  jsonLdGraph,
  jsonLdScript,
  serializeJsonLd,
} from "./seo";

describe("serializeJsonLd", () => {
  it("serializes a plain node to valid JSON", () => {
    const json = serializeJsonLd({ "@type": "Organization", name: "YouInc" });
    expect(JSON.parse(json)).toEqual({ "@type": "Organization", name: "YouInc" });
  });

  it("escapes every '<' so '</script' can never appear in the output", () => {
    const malicious = {
      "@type": "WebPage",
      name: '</script><script>alert("xss")</script>',
    };
    const json = serializeJsonLd(malicious);
    expect(json).not.toContain("</script");
    expect(json).not.toContain("<script");
    expect(json).not.toContain("<");
  });

  it("neutralizes an HTML-comment breakout attempt", () => {
    const json = serializeJsonLd({ "@type": "WebPage", name: "<!-- inject -->" });
    expect(json).not.toContain("<!--");
  });

  it("round-trips the escaped output back to the original data", () => {
    const original = {
      "@type": "FAQPage",
      name: "</script> & <b>bold</b> \"quoted\"",
    };
    const json = serializeJsonLd(original);
    expect(JSON.parse(json)).toEqual(original);
  });

  it("serializes an array of nodes", () => {
    const nodes = [
      { "@type": "Organization", name: "YouInc" },
      { "@type": "WebSite", name: "YouInc" },
    ];
    const json = serializeJsonLd(nodes);
    expect(JSON.parse(json)).toEqual(nodes);
  });
});

describe("jsonLdGraph", () => {
  it("wraps nodes in a @context + @graph document", () => {
    const graph = jsonLdGraph([
      { "@type": "Organization", name: "YouInc" },
      { "@type": "WebSite", name: "YouInc" },
    ]);
    expect(graph["@context"]).toBe("https://schema.org");
    expect(graph["@graph"]).toHaveLength(2);
  });
});

describe("jsonLdScript", () => {
  it("returns an application/ld+json script tag with escaped children", () => {
    const tag = jsonLdScript(
      jsonLdGraph([{ "@type": "WebPage", name: "</script>" }]),
    );
    expect(tag.type).toBe("application/ld+json");
    expect(tag.children).not.toContain("</script");
    expect(JSON.parse(tag.children)).toEqual({
      "@context": "https://schema.org",
      "@graph": [{ "@type": "WebPage", name: "</script>" }],
    });
  });
});

describe("breadcrumbList", () => {
  it("builds an ordered ListItem trail with fully-qualified URLs", () => {
    const node = breadcrumbList("https://youinc.net", [
      { name: "Home", path: "/" },
      { name: "Trust", path: "/security" },
    ]);
    expect(node["@type"]).toBe("BreadcrumbList");
    const items = node.itemListElement as Array<Record<string, unknown>>;
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      position: 1,
      name: "Home",
      item: "https://youinc.net/",
    });
    expect(items[1]).toMatchObject({
      position: 2,
      name: "Trust",
      item: "https://youinc.net/security",
    });
  });
});
