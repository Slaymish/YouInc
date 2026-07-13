// frontend/src/components/marketing/MarketingPage.tsx
//
// "The Incorporation" — the landing film. Seven acts, dark terminal cinema.
// Phase 1 composes the full static (reduced-motion) experience; Lenis/GSAP
// choreography (phase 2) and the WebGL particle film (phase 3) layer on top
// without changing this DOM.
import { useDarkTheme } from "./system/useDarkTheme";
import { Atmosphere } from "./system/Atmosphere";
import { MarketingHeader } from "./shell/MarketingHeader";
import { MarketingFooter } from "./shell/MarketingFooter";
import { Act01Hero } from "./film/Act01Hero";
import { Act02Engine } from "./film/Act02Engine";
import { Act03Command } from "./film/Act03Command";
import { Act04Pipeline } from "./film/Act04Pipeline";
import { Act04Security } from "./film/Act04Security";
import { Act05Concierge } from "./film/Act05Concierge";
import { Act06Pricing } from "./film/Act06Pricing";
import { Act07Close } from "./film/Act07Close";
import { Faq } from "./film/Faq";
import { FeedbackWidget } from "./FeedbackWidget";
import { SupportChat } from "./SupportChat";
import "./marketing-tokens.css";
import "./system/base.css";
import "./system/primitives.css";
import "./film/gl/staticBackdrops.css";
import "./FeedbackWidget.css";
import "./SupportChat.css";

export function MarketingPage() {
  useDarkTheme();
  return (
    <div className="mk">
      <Atmosphere />
      <MarketingHeader />
      <main className="mk-content">
        <Act01Hero />
        <Act02Engine />
        <Act03Command />
        <Act04Pipeline />
        <Act04Security />
        <Act05Concierge />
        <Act06Pricing />
        <Act07Close />
        <Faq />
      </main>
      <MarketingFooter />
      <SupportChat />
      <FeedbackWidget source="marketing" />
    </div>
  );
}
