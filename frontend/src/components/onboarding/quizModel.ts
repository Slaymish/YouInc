// Pure, dependency-free (no localStorage, no React) so vitest (node env) can
// import it directly. localStorage lives in quizStorage.ts.

export const QUIZ_STORAGE_KEY = "youinc-quiz-v1";
export const QUIZ_VERSION = 1;

export type QuizGoal = "net-worth" | "debt" | "save" | "see-it-all";
export type QuizCategory =
  | "everyday"
  | "savings"
  | "kiwisaver"
  | "investments"
  | "home"
  | "vehicle"
  | "mortgage"
  | "loan"
  | "creditcard";

export type LiquidityTier = "cash" | "semi_liquid" | "illiquid";

export interface QuizCategoryMeta {
  id: QuizCategory;
  label: string; // question label, e.g. "Everyday account"
  hint: string; // helper copy
  account: string; // namespaced ledger account path
  kind: "asset" | "liability";
  liquidityTier: LiquidityTier;
  sliderMaxCents: number; // sensible NZ upper bound for the slider
  sliderStepCents: number;
}

export interface QuizGoalMeta {
  id: QuizGoal;
  label: string;
}

export interface QuizEntry {
  category: QuizCategory;
  cents: number;
} // positive magnitude

export interface QuizState {
  version: number;
  goal: QuizGoal | null;
  entries: QuizEntry[];
}

export const QUIZ_GOALS: readonly QuizGoalMeta[] = [
  { id: "net-worth", label: "Know my true net worth" },
  { id: "debt", label: "Get on top of debt" },
  { id: "save", label: "Save for something big" },
  { id: "see-it-all", label: "Just see it all in one place" },
];

export const QUIZ_CATEGORIES: readonly QuizCategoryMeta[] = [
  {
    id: "everyday",
    label: "Everyday account",
    hint: "Your main transaction account",
    account: "Assets:Bank:Everyday",
    kind: "asset",
    liquidityTier: "cash",
    sliderMaxCents: 5_000_000,
    sliderStepCents: 10_000,
  },
  {
    id: "savings",
    label: "Savings",
    hint: "Rainy-day or term deposits",
    account: "Assets:Bank:Savings",
    kind: "asset",
    liquidityTier: "cash",
    sliderMaxCents: 20_000_000,
    sliderStepCents: 50_000,
  },
  {
    id: "kiwisaver",
    label: "KiwiSaver",
    hint: "Your current balance",
    account: "Assets:Investments:KiwiSaver",
    kind: "asset",
    liquidityTier: "semi_liquid",
    sliderMaxCents: 30_000_000,
    sliderStepCents: 50_000,
  },
  {
    id: "investments",
    label: "Shares & funds",
    hint: "Managed funds, shares, crypto",
    account: "Assets:Investments:Shares",
    kind: "asset",
    liquidityTier: "semi_liquid",
    sliderMaxCents: 50_000_000,
    sliderStepCents: 50_000,
  },
  {
    id: "home",
    label: "Home",
    hint: "Estimated market value",
    account: "Assets:Property:Home",
    kind: "asset",
    liquidityTier: "illiquid",
    sliderMaxCents: 200_000_000,
    sliderStepCents: 500_000,
  },
  {
    id: "vehicle",
    label: "Vehicle",
    hint: "Cars, boats, etc.",
    account: "Assets:Property:Vehicle",
    kind: "asset",
    liquidityTier: "illiquid",
    sliderMaxCents: 20_000_000,
    sliderStepCents: 50_000,
  },
  {
    id: "mortgage",
    label: "Mortgage",
    hint: "What you still owe",
    account: "Liabilities:Mortgage",
    kind: "liability",
    liquidityTier: "illiquid",
    sliderMaxCents: 200_000_000,
    sliderStepCents: 500_000,
  },
  {
    id: "loan",
    label: "Loans",
    hint: "Personal or student loans",
    account: "Liabilities:Loan",
    kind: "liability",
    liquidityTier: "semi_liquid",
    sliderMaxCents: 20_000_000,
    sliderStepCents: 50_000,
  },
  {
    id: "creditcard",
    label: "Credit card / BNPL",
    hint: "Current balance owing",
    account: "Liabilities:CreditCard",
    kind: "liability",
    liquidityTier: "cash",
    sliderMaxCents: 5_000_000,
    sliderStepCents: 10_000,
  },
];

const GOAL_IDS = new Set<string>(QUIZ_GOALS.map((g) => g.id));
const CATEGORY_IDS = new Set<string>(QUIZ_CATEGORIES.map((c) => c.id));

export function emptyQuizState(): QuizState {
  return { version: QUIZ_VERSION, goal: null, entries: [] };
}

export function serializeQuizState(state: QuizState): string {
  return JSON.stringify(state);
}

function isEntry(value: unknown): value is QuizEntry {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.category === "string" &&
    CATEGORY_IDS.has(e.category) &&
    typeof e.cents === "number" &&
    Number.isInteger(e.cents) &&
    e.cents >= 0
  );
}

export function parseQuizState(raw: string | null): QuizState | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const s = parsed as Record<string, unknown>;
  if (s.version !== QUIZ_VERSION) return null;
  if (!(s.goal === null || (typeof s.goal === "string" && GOAL_IDS.has(s.goal)))) return null;
  if (!Array.isArray(s.entries) || !s.entries.every(isEntry)) return null;
  return {
    version: QUIZ_VERSION,
    goal: s.goal as QuizGoal | null,
    entries: s.entries as QuizEntry[],
  };
}
