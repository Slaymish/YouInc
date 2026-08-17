// frontend/src/components/marketing/MarketingPage.tsx
//
// "The Incorporation" — the landing film. Seven acts, dark terminal cinema.
// The DOM below is the complete static (reduced-motion) experience; the
// Lenis/GSAP choreography (useFilmMotion) and the WebGL particle film
// (CinematicCanvas) layer on top at runtime without changing it.
import { useRef } from "react";
import { useDarkTheme } from "./system/useDarkTheme";
import { Atmosphere } from "./system/Atmosphere";
import { MarketingHeader } from "./shell/MarketingHeader";
import { MarketingFooter } from "./shell/MarketingFooter";
import { Act01Hero } from "./film/Act01Hero";
import { Act02Engine } from "./film/Act02Engine";
import { Act03Command } from "./film/Act03Command";
import { Act04Pipeline } from "./film/Act04Pipeline";
import { Act04Security } from "./film/Act04Security";
import { Act05SelfHost } from "./film/Act05SelfHost";
import { Act07Close } from "./film/Act07Close";
import { Faq } from "./film/Faq";
import { useFilmMotion } from "./film/useFilmMotion";
import { CinematicCanvas } from "./film/gl/CinematicCanvas";
import { FeedbackWidget } from "./FeedbackWidget";
import { SupportChat } from "./SupportChat";
import "./marketing-tokens.css";
import "./system/base.css";
import "./system/primitives.css";
import "./film/gl/staticBackdrops.css";
import "./film/motion-overrides.css";
import "./FeedbackWidget.css";
import "./SupportChat.css";

export function MarketingPage() {
  useDarkTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  useFilmMotion(rootRef);

  return (
    <div className="mk" ref={rootRef}>
      <Atmosphere />
      <CinematicCanvas />
      <MarketingHeader />
      <main className="mk-content">
        <Act01Hero />
        <Act02Engine />
        <Act03Command />
        <Act04Pipeline />
        <Act04Security />
        <Act05SelfHost />
        <Act07Close />
        <Faq />
      </main>
      <MarketingFooter />
      <SupportChat />
      <FeedbackWidget source="marketing" />
    </div>
  );
}
