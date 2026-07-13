import { describe, expect, it } from "vitest";
import { quizToLedger } from "./quizToLedger";
import type { QuizState } from "./quizModel";

const state = (entries: QuizState["entries"]): QuizState => ({
  version: 1,
  goal: "net-worth",
  entries,
});

describe("quizToLedger", () => {
  it("keeps assets positive and negates liabilities", () => {
    const out = quizToLedger(
      state([
        { category: "everyday", cents: 420000 },
        { category: "mortgage", cents: 30000000 },
      ]),
    );
    expect(out).toContainEqual({ account: "Assets:Bank:Everyday", balanceCents: 420000 });
    expect(out).toContainEqual({ account: "Liabilities:Mortgage", balanceCents: -30000000 });
  });

  it("omits zero-value entries", () => {
    expect(quizToLedger(state([{ category: "savings", cents: 0 }]))).toEqual([]);
  });

  it("maps every category to its configured account path", () => {
    const out = quizToLedger(
      state([
        { category: "kiwisaver", cents: 100 },
        { category: "creditcard", cents: 100 },
      ]),
    );
    expect(out).toContainEqual({ account: "Assets:Investments:KiwiSaver", balanceCents: 100 });
    expect(out).toContainEqual({ account: "Liabilities:CreditCard", balanceCents: -100 });
  });
});
