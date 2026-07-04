import { StaticMarketingPage } from "./StaticMarketingPage";
import { pageData, type StaticPageId } from "./staticPages";

export function staticPageHead(id: StaticPageId) {
  const page = pageData(id);
  return {
    meta: [
      { title: page.title },
      { name: "description", content: page.description },
    ],
  };
}

export function renderStaticPage(id: StaticPageId) {
  return function StaticPageRoute() {
    return <StaticMarketingPage id={id} />;
  };
}
