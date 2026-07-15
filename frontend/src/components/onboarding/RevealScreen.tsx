import { Link } from "@tanstack/react-router";
import { buildRevealDashboard } from "./buildRevealDashboard";
import { type QuizState } from "./quizModel";
import { assetMix } from "~/components/widgets/derive";
import { formatMoney, leafAccount } from "~/components/widgets/format";
import { trackProductEvent } from "~/lib/productAnalytics";

const GOAL_CALLBACK: Record<string, string> = {
  "net-worth": "Here's your true net worth.",
  debt: "Here's exactly what you owe — and what you own.",
  save: "Here's what you've got to build on.",
  "see-it-all": "Here's everything, in one place.",
};

const TIER_LABEL: Record<string, string> = {
  cash: "Cash",
  semi_liquid: "Investments",
  illiquid: "Property & fixed",
};

export function RevealScreen({
  state,
  onRestart,
}: {
  state: QuizState;
  onRestart: () => void;
}) {
  const dashboard = buildRevealDashboard(state);
  const { totals, balances } = dashboard;
  const mix = assetMix(balances);
  const mixSlices = mix.slices.filter((s) => s.cents > 0);
  const goalLabel = state.goal ? GOAL_CALLBACK[state.goal] : "Here's your picture.";
  const liabilities = balances.filter((b) => b.accountType === "Liabilities");

  return (
    <main className="mk reveal">
      <p className="reveal__eyebrow">{goalLabel}</p>
      <h1 className="reveal__networth">{formatMoney(totals.netWorthCents)}</h1>
      <p className="reveal__label">Net worth</p>

      <div className="reveal__split">
        <div>
          <span className="reveal__split-label">Assets</span>
          <span>{formatMoney(totals.assetsCents)}</span>
        </div>
        <div>
          <span className="reveal__split-label">Liabilities</span>
          <span>{formatMoney(totals.liabilitiesCents)}</span>
        </div>
      </div>

      {mixSlices.length > 0 && (
        <section className="reveal__mix" aria-label="Asset mix">
          {mixSlices.map((s) => (
            <div key={s.tier} className="reveal__mix-row">
              <span className="reveal__mix-tier">{TIER_LABEL[s.tier] ?? s.tier}</span>
              <span className="reveal__mix-track">
                <span className="reveal__mix-bar" style={{ transform: `scaleX(${s.fraction})` }} />
              </span>
              <span className="reveal__mix-amount">{formatMoney(s.cents)}</span>
            </div>
          ))}
        </section>
      )}

      {liabilities.length > 0 && (
        <ul className="reveal__debts">
          {liabilities.map((b) => (
            <li key={b.account}>
              <span>{leafAccount(b.account)}</span>
              <span>{formatMoney(-b.balanceCents)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="reveal__actions">
        <Link
          className="mk-btn mk-btn--primary"
          to="/signup"
          onClick={() =>
            trackProductEvent("marketing_cta_clicked", { placement: "quiz-reveal" })
          }
        >
          Save your picture →
        </Link>
        <button type="button" className="mk-btn mk-btn--ghost" onClick={onRestart}>
          Start over
        </button>
      </div>
      <p className="reveal__reassure">Free. No card. Your numbers stay yours.</p>
    </main>
  );
}
