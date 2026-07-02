// frontend/src/components/marketing/MarketingPage.tsx
import { Link } from "@tanstack/react-router";
import { PRODUCT, BOOKING_URL } from "./config";
import { useLightTheme } from "./DemoBoard";
import { Hero } from "./Hero";
import { LiveProofStrip } from "./LiveProofStrip";
import { HowItWorks } from "./HowItWorks";
import { WidgetShowcase } from "./WidgetShowcase";
import { BespokeSection } from "./BespokeSection";
import { Pricing } from "./Pricing";
import { WaitlistForm } from "./WaitlistForm";
import { Faq } from "./Faq";
import { MarketingFooter } from "./MarketingFooter";
import "./marketing.css";
import "../dashboard/dashboard.css"; // widget styles for the showcase

export function MarketingPage() {
  useLightTheme();
  return (
    <div className="mk">
      <header className="mk-nav">
        <span className="mk-nav__logo">{PRODUCT.name}</span>
        <nav className="mk-nav__links" aria-label="Main navigation">
          <a href="#showcase-heading">Widgets</a>
          <a href="#pricing-heading">Pricing</a>
          <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">Custom builds</a>
          <Link className="mk-nav__signin" to="/login">Sign in</Link>
        </nav>
      </header>
      <main>
        <Hero />
        <LiveProofStrip />
        <HowItWorks />
        <WidgetShowcase />
        <BespokeSection />
        <Pricing />
        <section className="final-cta" aria-labelledby="final-heading">
          <h2 id="final-heading" className="section-heading">Start running yourself like a company.</h2>
          <WaitlistForm source="final-cta" />
        </section>
        <Faq />
      </main>
      <MarketingFooter />
    </div>
  );
}
