import { describe, expect, it } from "vitest";
import {
  emptyQuizState,
  parseQuizState,
  serializeQuizState,
  QUIZ_CATEGORIES,
  type QuizState,
} from "./quizModel";

describe("quizModel", () => {
  it("round-trips a valid state through serialize/parse", () => {
    const state: QuizState = {
      version: 1,
      goal: "net-worth",
      entries: [{ category: "everyday", cents: 420000 }],
    };
    expect(parseQuizState(serializeQuizState(state))).toEqual(state);
  });

  it("returns null for null, malformed JSON, and wrong-shape input", () => {
    expect(parseQuizState(null)).toBeNull();
    expect(parseQuizState("{not json")).toBeNull();
    expect(parseQuizState(JSON.stringify({ version: 1 }))).toBeNull();
    expect(
      parseQuizState(JSON.stringify({ version: 99, goal: "net-worth", entries: [] })),
    ).toBeNull();
  });

  it("rejects entries with unknown categories or non-integer cents", () => {
    expect(
      parseQuizState(
        JSON.stringify({ version: 1, goal: "net-worth", entries: [{ category: "boat", cents: 1 }] }),
      ),
    ).toBeNull();
    expect(
      parseQuizState(
        JSON.stringify({
          version: 1,
          goal: "net-worth",
          entries: [{ category: "everyday", cents: 1.5 }],
        }),
      ),
    ).toBeNull();
  });

  it("exposes an ordered category list with account paths and asset/liability kind", () => {
    const everyday = QUIZ_CATEGORIES.find((c) => c.id === "everyday");
    const mortgage = QUIZ_CATEGORIES.find((c) => c.id === "mortgage");
    expect(everyday?.account).toBe("Assets:Bank:Everyday");
    expect(everyday?.kind).toBe("asset");
    expect(mortgage?.account).toBe("Liabilities:Mortgage");
    expect(mortgage?.kind).toBe("liability");
  });

  it("emptyQuizState has no goal and no entries", () => {
    expect(emptyQuizState()).toEqual({ version: 1, goal: null, entries: [] });
  });
});
