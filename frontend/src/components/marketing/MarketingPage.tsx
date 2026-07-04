// frontend/src/components/marketing/MarketingPage.tsx
import { useLightTheme } from "./useLightTheme";
import { MarketingHeader } from "./MarketingHeader";
import { Hero } from "./Hero";
import { LiveProofStrip } from "./LiveProofStrip";
import { HowItWorks } from "./HowItWorks";
import { DashboardFrame } from "./DashboardFrame";
import { BespokeSection } from "./BespokeSection";
import { ConciergeShowcase } from "./ConciergeShowcase";
import { Pricing } from "./Pricing";
import { StartFreeCta } from "./StartFreeCta";
import { Faq } from "./Faq";
import { MarketingFooter } from "./MarketingFooter";
import { FeedbackWidget } from "./FeedbackWidget";
import { SupportChat } from "./SupportChat";
import "./marketing-tokens.css";
import "./marketing-shared.css";
import "../dashboard/dashboard.css"; // widget styles for the showcase
import "./FeedbackWidget.css";
import "./SupportChat.css";

export function MarketingPage() {
  useLightTheme();
  return (
    <div className="mk">
      <MarketingHeader />
      <main>
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
