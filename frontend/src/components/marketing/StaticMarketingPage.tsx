import { Link } from "@tanstack/react-router";
import { MarketingHeader } from "./MarketingHeader";
import { MarketingFooter } from "./MarketingFooter";
import { useLightTheme } from "./useLightTheme";
import { pageData, type StaticPageId } from "./staticPages";
import "./marketing-tokens.css";
import "./marketing-shared.css";
import "./static-page.css";

interface StaticMarketingPageProps {
  id: StaticPageId;
}

export function StaticMarketingPage({ id }: StaticMarketingPageProps) {
  useLightTheme();
  const page = pageData(id);

  return (
    <div className="mk">
      <MarketingHeader />
      <main className="static-page">
        <section className="static-page__hero" aria-labelledby="static-page-heading">
          <p className="mk-eyebrow">{page.eyebrow}</p>
          <h1 id="static-page-heading" className="static-page__heading">
            {page.heading}
          </h1>
          <p className="static-page__subheading">{page.subheading}</p>
          {page.updated ? (
            <p className="static-page__updated">Last updated: {page.updated}</p>
          ) : null}
        </section>

        <section className="static-page__content" aria-label={`${page.heading} details`}>
          {page.sections.map((section) => (
            <article className="static-page__section" key={section.title}>
              <h2>{section.title}</h2>
              {section.body ? <p>{section.body}</p> : null}
              {section.items ? (
                <ul>
                  {section.items.map((item, index) => (
                    <li key={`${section.title}-${index}`}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </section>

        {page.cta ? (
          <section className="static-page__cta" aria-label="Next step">
            {page.cta.external ? (
              <a
                className="mk-btn mk-btn--primary"
                href={page.cta.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {page.cta.label}
              </a>
            ) : (
              <Link className="mk-btn mk-btn--primary" to={page.cta.href}>
                {page.cta.label}
              </Link>
            )}
          </section>
        ) : null}
      </main>
      <MarketingFooter />
    </div>
  );
}
