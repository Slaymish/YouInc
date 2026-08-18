// Narrative copy for "The Incorporation" landing film. Voice: plain, short,
// specific. No exclamation marks, no supercharge/unlock/seamless. Feature
// claims stay consistent with config.ts and the real engine (rules routing,
// NZFCC fallback, suspense safety, RLS, Vault).
//
// Headlines are split `lead` + `em` because the acts wrap the second half in
// <em>. Keep the split here, not as literals in the components, so there is one
// copy of every line.

export const HERO = {
  eyebrow: { index: "00", label: "Personal ERP · self-hosted" },
  headline: { line1: "Run yourself", line2: "like a", em: "company." },
  reassurance: "Open source · read-only bank access · runs on your machine",
} as const;

export const ENGINE = {
  eyebrow: { index: "01", label: "The Engine" },
  beats: [
    {
      lead: "Every dollar gets an account.",
      body: "Your bank feed arrives as raw transactions. Each one is posted into a real double-entry ledger.",
    },
    {
      lead: "Every entry balances.",
      body: "Debits equal credits on every transaction, so when the books stop balancing you find out.",
    },
    {
      lead: "Nothing gets guessed.",
      body: "Rules sort each transaction, with NZFCC categories as the fallback. Anything still ambiguous waits in suspense rather than being filed somewhere plausible.",
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
  body: "Net worth, runway and cashflow, read straight off your ledger. Not a spreadsheet you abandoned in March.",
} as const;

export const PIPELINE = {
  eyebrow: { index: "03", label: "The Pipeline" },
  headline: "Three steps from bank to board.",
  log: [
    { glyph: "$", label: "connect akahu", dots: 12, value: "read-only, 90 seconds" },
    { glyph: "→", label: "rules engine routing", dots: 6, value: "214 transactions posted" },
    { glyph: "→", label: "ledger balanced", dots: 8, value: "assets = liabilities + equity" },
    { glyph: "●", label: "dashboard live", dots: 9, value: "net worth ticking", live: true },
  ],
  steps: [
    { title: "Connect", body: "Link your NZ bank through Akahu. Takes about ninety seconds, and the access is read-only." },
    { title: "Route", body: "The rules engine classifies each transaction and holds back the ones it cannot place." },
    { title: "Report", body: "The balanced ledger becomes your dashboard: net worth, runway, cashflow, and whatever is out of line." },
  ],
} as const;

export const SECURITY = {
  eyebrow: { index: "04", label: "Security" },
  headline: { lead: "It can read your money.", em: "It can't move it." },
  entries: [
    { label: "Read-only", body: "Akahu grants transaction access and nothing else. No payment scope is ever requested." },
    { label: "Encrypted", body: "Bank tokens live in Supabase Vault and are read server-side only. They never reach the browser." },
    { label: "Isolated", body: "Row-level security separates tenants in the database itself, so no other session can read your ledger." },
  ],
} as const;

export const SELF_HOST = {
  eyebrow: { index: "05", label: "Run it yourself" },
  headline: { lead: "Your ledger,", em: "on your machine." },
  body: "There is no account to create. Clone the repo, bring your own Postgres, and point it at your own Akahu connection. The instance is yours, including the parts you want to change.",
  steps: [
    { title: "Clone", body: "One repository: the engine, the dashboard and the database migrations." },
    { title: "Run", body: "Docker Compose brings up Postgres and the app. No hosted dependency, no telemetry." },
    { title: "Own", body: "Your transactions stay on your infrastructure. Export the whole ledger as plain text whenever you want." },
  ],
} as const;

export const CLOSE = {
  eyebrow: { index: "06", label: "Incorporate" },
  headline: { lead: "Incorporate", em: "yourself." },
  reassurance: "Open source · self-hosted · yours to fork",
} as const;
