import { Link } from "@tanstack/react-router";
import { SOURCE_URL } from "~/components/marketing/config";
import "./install-prompt.css";

/**
 * The demo's honest end: connecting a real bank needs your own instance and
 * your own Akahu credentials. This is where the sample data stops being
 * interesting, so it's where the install prompt goes rather than on every page.
 */
export function InstallPrompt() {
  return (
    <section className="install" aria-labelledby="install-heading">
      <h2 id="install-heading">This is where you'd connect your bank</h2>
      <p>
        Not from here, though. Real accounts need a copy running on your own
        machine, against your own database, with bank credentials you get
        yourself — nothing about your money passes through this website.
      </p>
      <p className="install__how">
        Setting it up takes a terminal and about ten minutes today. A packaged
        version you can download and run is the next piece of work.
      </p>
      <div className="install__actions">
        <Link className="mk-btn mk-btn--primary" to="/docs">
          <span className="mk-btn__label">How to set it up</span>
        </Link>
        <a
          className="mk-btn mk-btn--ghost"
          href={SOURCE_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="mk-btn__label">Source on GitHub</span>
        </a>
      </div>
    </section>
  );
}
