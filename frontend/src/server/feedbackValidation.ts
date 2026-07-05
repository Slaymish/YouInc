// Pure feedback validation — no Supabase/native imports, so vitest can unit-test
// it without the app's Vite alias plugins (mirrors ruleValidation.ts).
import { z } from "zod";
import { throwServerError } from "./serverError";

const FeedbackSchema = z.object({
  vote: z.enum(["up", "down"]),
  note: z.string().trim().max(500).optional(),
  variant: z.enum(["A", "B"]),
  source: z.string().max(60),
  path: z.string().max(300),
});

export type FeedbackInput = z.infer<typeof FeedbackSchema>;

/** Validate the payload; throws a 400 ServerFnError on invalid input. */
export function validateFeedback(input: unknown): FeedbackInput {
  const parsed = FeedbackSchema.safeParse(input);
  if (!parsed.success) {
    throwServerError("Invalid feedback payload.", 400);
  }
  return parsed.data;
}
