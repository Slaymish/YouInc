import { createFileRoute } from "@tanstack/react-router";
import { useDarkTheme } from "~/components/marketing/system/useDarkTheme";
import { Atmosphere } from "~/components/marketing/system/Atmosphere";
import { QuizFlow } from "~/components/onboarding/QuizFlow";
import "~/components/marketing/marketing-tokens.css";
import "~/components/marketing/system/base.css";
import "~/components/marketing/system/primitives.css";
import "~/components/onboarding/onboarding-quiz.css";

export const Route = createFileRoute("/start")({
  head: () => ({
    meta: [
      { title: "See your financial picture — YouInc" },
      {
        name: "description",
        content:
          "See your whole financial picture in about two minutes — no account needed.",
      },
    ],
  }),
  component: StartPage,
});

function StartPage() {
  useDarkTheme();
  return (
    <div className="mk">
      <Atmosphere />
      <QuizFlow />
    </div>
  );
}
