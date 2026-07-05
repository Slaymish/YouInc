// Pure lead validation — no Supabase/native imports, so vitest can unit-test it
// without the app's Vite alias plugins (mirrors ruleValidation.ts).
import { z } from "zod";
import { throwServerError } from "./serverError";

const WaitlistSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().max(120).optional(),
  interest: z.enum(["self-serve", "concierge"]).optional(),
  source: z.string().max(60).optional(),
  userAgent: z.string().max(400).optional(),
  // Honeypot: real users never fill this. Bots do.
  company: z.string().max(200).optional(),
});

export type WaitlistInput = z.infer<typeof WaitlistSchema>;

/**
 * Validate the payload and decide honeypot handling. Throws a 400 ServerFnError
 * on invalid input; returns { skip: true } for a filled honeypot (caller
 * pretends success, stores nothing); otherwise the parsed lead.
 */
export function validateLead(input: unknown): { lead: WaitlistInput } | { skip: true } {
  const parsed = WaitlistSchema.safeParse(input);
  if (!parsed.success) {
    throwServerError("Please enter a valid email address.", 400);
  }
  const lead = parsed.data;
  if (lead.company && lead.company.trim().length > 0) {
    return { skip: true };
  }
  return { lead };
}
