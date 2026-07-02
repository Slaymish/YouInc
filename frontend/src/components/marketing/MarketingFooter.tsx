// frontend/src/components/marketing/MarketingFooter.tsx
import { PRODUCT } from "./config";

export function MarketingFooter() {
  return (
    <footer className="mk-footer">
      <span>{PRODUCT.name}</span>
      <span className="mk-footer__note">Run yourself like a company.</span>
    </footer>
  );
}
