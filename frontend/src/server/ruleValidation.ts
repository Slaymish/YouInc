// Pure validation/normalization for classification-rule edits, kept
// dependency-free (no Supabase, no `~/` aliases) so it can be unit-tested under
// the plugin-free vitest config. tenantRules.ts composes these.

export interface RuleInput {
  ruleKey: string;
  priority: number;
  isEnabled: boolean;
  matchDescriptionRegex: string | null;
  matchMerchantRegex: string | null;
  matchAmountGreaterThan: number | null;
  matchAmountAbsGreaterThan: number | null;
  targetAccount: string;
  memo: string | null;
}

/** Raised on invalid input; tenantRules maps this to a 400 Response. */
export class RuleValidationError extends Error {}

/** rule_key: lowercase, non-alphanumerics collapsed to "_", trimmed. */
export function normalizeRuleKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Validate a regex the same way the router will: it uses JS RegExp after
 * stripping a leading (?i)/(?im)/... inline flag group (V8 rejects those inline
 * groups). Returns void; throws RuleValidationError on an invalid pattern.
 */
export function assertValidRegex(pattern: string | null, field: string): void {
  if (!pattern) return;
  let body = pattern;
  const flagMatch = /^\(\?([imsx]+)\)/.exec(body);
  let flags = "";
  if (flagMatch) {
    body = body.slice(flagMatch[0].length);
    for (const f of flagMatch[1]) {
      if ("ims".includes(f)) flags += f;
    }
  }
  try {
    new RegExp(body, flags);
  } catch {
    throw new RuleValidationError(`The ${field} pattern is not a valid regular expression.`);
  }
}

/**
 * Normalize + validate a rule input. Throws RuleValidationError with a
 * user-facing message on any problem. Returns the input with a cleaned ruleKey
 * and trimmed targetAccount.
 */
export function normalizeRuleInput(input: RuleInput): RuleInput {
  const ruleKey = normalizeRuleKey(input.ruleKey);
  const targetAccount = input.targetAccount.trim();

  if (ruleKey.length === 0) throw new RuleValidationError("Give the rule a name.");
  if (!targetAccount.includes(":")) {
    throw new RuleValidationError("Target account must be namespaced, e.g. Expenses:Software.");
  }
  if (!Number.isFinite(input.priority)) {
    throw new RuleValidationError("Priority must be a number.");
  }
  assertValidRegex(input.matchDescriptionRegex, "description");
  assertValidRegex(input.matchMerchantRegex, "merchant");

  const hasCondition =
    Boolean(input.matchDescriptionRegex) ||
    Boolean(input.matchMerchantRegex) ||
    input.matchAmountGreaterThan != null ||
    input.matchAmountAbsGreaterThan != null;
  if (!hasCondition) {
    throw new RuleValidationError(
      "Add at least one match condition (description, merchant, or amount) so the rule is specific.",
    );
  }

  return { ...input, ruleKey, targetAccount };
}
