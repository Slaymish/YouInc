import { QUIZ_CATEGORIES, type QuizState } from "./quizModel";

const META_BY_ID = new Map(QUIZ_CATEGORIES.map((c) => [c.id, c]));

export function quizToLedger(state: QuizState): { account: string; balanceCents: number }[] {
  const out: { account: string; balanceCents: number }[] = [];
  for (const entry of state.entries) {
    if (entry.cents <= 0) continue;
    const meta = META_BY_ID.get(entry.category);
    if (!meta) continue;
    const signed = meta.kind === "liability" ? -entry.cents : entry.cents;
    out.push({ account: meta.account, balanceCents: signed });
  }
  return out;
}
