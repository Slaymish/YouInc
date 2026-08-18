import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import type { LedgerDashboardData } from "~/components/dashboard/dashboardData";
import { Explainer } from "~/components/ui/Explainer";
import { headlineMetrics } from "./headlineMetrics";
import { observations } from "./observations";
import { attentionLink } from "./attentionRoutes";
import type { NavBase } from "~/components/app/nav";
import { buildControlBrief } from "~/components/widgets/ControlBriefWidget";
import { buildAttentionItems } from "~/components/widgets/derive";
import "./home.css";

/**
 * Home's whole answer to "am I OK?": the control brief as the headline, the
 * four numbers behind it, anything that needs a person, then what the app
 * noticed. Shared by the real instance and the demo so they can't drift.
 */
export function HomeSummary({
  dashboard,
  subtitle,
  base = "/app",
}: {
  readonly dashboard: LedgerDashboardData;
  readonly subtitle: string;
  /** Which copy of the pages the rows link into — /app, or /demo. */
  readonly base?: NavBase;
}) {
  const brief = useMemo(() => buildControlBrief(dashboard), [dashboard]);
  const metrics = useMemo(() => headlineMetrics(dashboard), [dashboard]);
  const attention = useMemo(() => buildAttentionItems(dashboard), [dashboard]);
  const noticed = useMemo(
    () =>
      observations({
        categoryMonthly: dashboard.categoryMonthly,
        recurringPayments: dashboard.recurringPayments,
      }),
    [dashboard.categoryMonthly, dashboard.recurringPayments],
  );

  return (
    <>
      <header className="home-headline">
        <p className="home-headline__question">{subtitle}</p>
        <h1>{brief.title}</h1>
        <p className="home-headline__line">{brief.body}</p>
      </header>

      <section className="home-numbers" aria-label="Your headline figures">
        {metrics.map((metric) => (
          <article className="home-metric" key={metric.id}>
            <p className="home-metric__label">
              {metric.label}
              <Explainer subject={metric.label.toLowerCase()} lines={metric.explainer} />
            </p>
            <strong className="home-metric__value">{metric.value}</strong>
          </article>
        ))}
      </section>

      <section className="home-block" aria-labelledby="home-needs-heading">
        <h2 id="home-needs-heading" className="home-block__heading">
          Needs you
          {attention.length ? <span> ({attention.length})</span> : null}
        </h2>
        {attention.length === 0 ? (
          <p className="home-block__empty">
            Nothing right now. Anything that needs a decision turns up here.
          </p>
        ) : (
          <ul className="home-needs">
            {attention.map((item) => {
              const link = attentionLink(item, base);
              return (
                <li className={`home-need home-need--${item.severity}`} key={item.id}>
                  <span className="home-need__dot" aria-hidden="true" />
                  <span className="home-need__text">
                    <strong>{item.label}</strong>
                    <span>{item.detail}</span>
                  </span>
                  <Link className="home-need__go" to={link.to}>
                    {link.label} →
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="home-block" aria-labelledby="home-noticed-heading">
        <h2 id="home-noticed-heading" className="home-block__heading">
          Noticed
        </h2>
        {noticed.length === 0 ? (
          <p className="home-block__empty">
            Once there are a few months of transactions, anything that stands out
            shows up here — a bill creeping up, a quiet month, that sort of thing.
          </p>
        ) : (
          <ul className="home-noticed">
            {noticed.map((observation) => (
              <li
                className={`home-noticed__row home-noticed__row--${observation.tone}`}
                key={observation.id}
              >
                {observation.text}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
