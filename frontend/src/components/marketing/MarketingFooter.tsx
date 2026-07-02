// frontend/src/components/marketing/MarketingFooter.tsx
import { PRODUCT } from "./config";

export function MarketingFooter() {
  return (
    <footer className="mk-footer">
      <span>{PRODUCT.name}</span>
      <span className="mk-footer__note">Run yourself like a company.</span>
      <a
        className="mk-footer__credit"
        href="https://hamishburke.dev"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img src="/HB_logo.svg" alt="" width="16" height="16" aria-hidden="true" />
        Built by Hamish Burke
      </a>
    </footer>
  );
}
