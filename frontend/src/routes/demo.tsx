import { createFileRoute, Link } from "@tanstack/react-router";
import { DemoBoard, useLightTheme } from "~/components/marketing/DemoBoard";
import { BOOKING_URL } from "~/components/marketing/config";
import "~/components/dashboard/dashboard.css";
import "~/components/marketing/marketing.css";

export const Route = createFileRoute("/demo")({
  component: DemoPage,
});

function DemoPage() {
  useLightTheme();
  return (
    <main className="mk">
      <header className="demo-banner">
        <div>
          <strong>Live demo</strong> — sample data, read-only. This is exactly what your
          dashboard looks like once your bank is connected.
        </div>
        <nav className="demo-banner__cta">
          <Link className="mk-btn mk-btn--ghost" to="/">
            ← Back
          </Link>
          <a className="mk-btn mk-btn--primary" href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
            Book a call
          </a>
        </nav>
      </header>
      <DemoBoard />
    </main>
  );
}
