// frontend/src/components/marketing/MarketingPage.tsx
import { useDarkTheme } from "./system/useDarkTheme";
import { Atmosphere } from "./system/Atmosphere";
import { MarketingHeader } from "./shell/MarketingHeader";
import { MarketingFooter } from "./shell/MarketingFooter";
import { Hero } from "./Hero";
import { LiveProofStrip } from "./LiveProofStrip";
import { HowItWorks } from "./HowItWorks";
import { DashboardFrame } from "./DashboardFrame";
import { BespokeSection } from "./BespokeSection";
import { ConciergeShowcase } from "./ConciergeShowcase";
import { Pricing } from "./Pricing";
import { StartFreeCta } from "./StartFreeCta";
import { Faq } from "./Faq";
import { FeedbackWidget } from "./FeedbackWidget";
import { SupportChat } from "./SupportChat";
import "./marketing-tokens.css";
import "./system/base.css";
import "./system/primitives.css";
import "./marketing-shared.css";
import "../dashboard/dashboard.css"; // widget styles for the showcase
import "./FeedbackWidget.css";
import "./SupportChat.css";

export function MarketingPage() {
  useDarkTheme();
  return (
    <div className="mk">
      <Atmosphere />
      <MarketingHeader />
      <main className="mk-content">
        <Hero />
        <LiveProofStrip />
        <HowItWorks />
        <DashboardFrame />
        <BespokeSection />
        <ConciergeShowcase />
        <Pricing />
        <section className="final-cta" aria-labelledby="final-heading">
          <h2 id="final-heading" className="section-heading">
            Start running yourself like a company.
          </h2>
          <StartFreeCta source="final-cta" withDemo />
        </section>
        <Faq />
      </main>
      <MarketingFooter />
      <SupportChat />
      <FeedbackWidget source="marketing" />
    </div>
  );
}
