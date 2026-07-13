// Narrative copy for "The Incorporation" landing film. Voice: assured, precise,
// faintly cinematic. Short declaratives. No exclamation marks, no
// supercharge/unlock/seamless. Feature claims stay consistent with config.ts and
// the real engine (rules routing, NZFCC fallback, suspense safety, RLS, Vault).

export const HERO = {
  eyebrow: { index: "00", label: "Personal ERP — Live bank sync (NZ)" },
  headline: "Run yourself like a company.",
  reassurance: "No card · Read-only bank access · Live in 2 minutes",
} as const;

export const ENGINE = {
  eyebrow: { index: "01", label: "The Engine" },
  beats: [
    {
      lead: "Every dollar gets an account.",
      body: "Your bank feed lands as raw transactions. The engine posts each one to a real double-entry ledger — nothing floats untracked.",
    },
    {
      lead: "Every entry balances.",
      body: "Double-entry isn't retro. It's why the numbers never lie: debits equal credits, on every transaction, always.",
    },
    {
      lead: "Nothing is silently wrong.",
      body: "Rules route each transaction. Unknowns fall back to NZFCC categories, and anything uncertain lands in suspense — flagged, never guessed.",
    },
  ],
  // Sample balanced rows for the static ledger composition. date · payee ·
  // account path · debit · credit (amounts already balance pairwise).
  ledger: [
    { date: "2026-07-08", payee: "KŌKAKO CAFE", account: "Expenses:Food:Coffee", debit: "4.50", credit: "" },
    { date: "2026-07-08", payee: "KŌKAKO CAFE", account: "Assets:Bank:Everyday", debit: "", credit: "4.50" },
    { date: "2026-07-07", payee: "MERIDIAN", account: "Expenses:Utilities:Power", debit: "220.00", credit: "" },
    { date: "2026-07-07", payee: "MERIDIAN", account: "Assets:Bank:Everyday", debit: "", credit: "220.00" },
    { date: "2026-07-05", payee: "ACME PAYROLL", account: "Assets:Bank:Everyday", debit: "2,847.00", credit: "" },
    { date: "2026-07-05", payee: "ACME PAYROLL", account: "Income:Salary", debit: "", credit: "2,847.00" },
    { date: "2026-07-03", payee: "COUNTDOWN", account: "Expenses:Food:Groceries", debit: "86.20", credit: "" },
    { date: "2026-07-03", payee: "COUNTDOWN", account: "Assets:Bank:Everyday", debit: "", credit: "86.20" },
  ],
} as const;

export const COMMAND = {
  eyebrow: { index: "02", label: "Command" },
  headline: "The CFO view of you.",
  body: "Net worth, runway, cashflow — live from your ledger, not a spreadsheet you abandoned in March.",
} as const;

export const PIPELINE = {
  eyebrow: { index: "03", label: "The Pipeline" },
  headline: "Four steps from bank to board.",
  log: [
    { glyph: "$", label: "connect akahu", dots: 12, value: "read-only, 90 seconds" },
    { glyph: "→", label: "rules engine routing", dots: 6, value: "214 transactions posted" },
    { glyph: "→", label: "ledger balanced", dots: 8, value: "assets = liabilities + equity" },
    { glyph: "●", label: "dashboard live", dots: 9, value: "net worth ticking", live: true },
  ],
  steps: [
    { title: "Connect", body: "Link your NZ bank through Akahu in about ninety seconds. Read-only — no payment access, ever." },
    { title: "Route", body: "The rules engine classifies each transaction. Anything it isn't sure about is held, not guessed." },
    { title: "Report", body: "A balanced ledger becomes the CFO view: net worth, runway, cashflow, and the one thing to do next." },
  ],
} as const;

export const SECURITY = {
  eyebrow: { index: "04", label: "Security posture" },
  headline: "Built like infrastructure, because it is.",
  entries: [
    { label: "Read-only", body: "Akahu open-finance access, no payment scopes. YouInc can see your transactions; it can never move your money." },
    { label: "Encrypted", body: "Bank tokens are sealed in Supabase Vault and read server-side only. They are never sent to the browser." },
    { label: "Isolated", body: "Row-level security walls every tenant at the database. Your ledger is unreachable from anyone else's session." },
  ],
} as const;

export const CONCIERGE = {
  eyebrow: { index: "05", label: "Concierge" },
  headline: "Your own engineering department.",
  body: "When the view you want doesn't exist yet, I build it — on your live ledger, by the person who built the product. The work below is illustrative of the kind of commissions I take.",
  // Illustrative mock-ups of bespoke work — kept honest, not shipped features.
  artifacts: [
    { spec: "Brief", brief: "Mortgage payoff, on target?", built: "A payoff-curve widget against a chosen date", shipped: "Live on the client's board in 6 days" },
    { spec: "Brief", brief: "One number for three side projects", built: "Per-project P&L, posted as journal tags", shipped: "Shipped as a pinned control-brief tile" },
    { spec: "Brief", brief: "Tell me before I overspend", built: "A weekly anomaly agent reading the ledger", shipped: "Monday brief, plain English, no chatbot" },
  ],
} as const;

export const PRICING_COPY = {
  eyebrow: { index: "06", label: "Pricing" },
  headline: "Four ways to keep the books.",
} as const;

export const CLOSE = {
  eyebrow: { index: "07", label: "Incorporate" },
  headline: "Incorporate yourself.",
  reassurance: "Free tier · No card · 2 minutes",
} as const;
