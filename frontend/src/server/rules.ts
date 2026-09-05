import { rows, execute, writeRecord, atomic } from "./database";
import {
  normalizeRuleInput,
  RuleValidationError,
  type RuleInput,
} from "./ruleValidation";
import { throwServerError } from "./serverError";

export type { RuleInput };

export interface ClassificationRule {
  id: string;
  ruleKey: string;
  seq: number;
  priority: number;
  isEnabled: boolean;
  matchDescriptionRegex: string | null;
  matchMerchantRegex: string | null;
  matchAmountGreaterThan: number | null;
  matchAmountAbsGreaterThan: number | null;
  targetAccount: string;
  memo: string | null;
}

interface RuleDbRow {
  id: string;
  rule_key: string;
  seq: number;
  priority: number;
  is_enabled: boolean;
  match_description_regex: string | null;
  match_merchant_regex: string | null;
  match_amount_greater_than: string | number | null;
  match_amount_abs_greater_than: string | number | null;
  route_target_account: string;
  route_memo: string | null;
}

function toRule(r: RuleDbRow): ClassificationRule {
  return {
    id: r.id,
    ruleKey: r.rule_key,
    seq: r.seq,
    priority: r.priority,
    isEnabled: Boolean(r.is_enabled),
    matchDescriptionRegex: r.match_description_regex,
    matchMerchantRegex: r.match_merchant_regex,
    matchAmountGreaterThan:
      r.match_amount_greater_than != null
        ? Number(r.match_amount_greater_than)
        : null,
    matchAmountAbsGreaterThan:
      r.match_amount_abs_greater_than != null
        ? Number(r.match_amount_abs_greater_than)
        : null,
    targetAccount: r.route_target_account,
    memo: r.route_memo,
  };
}

const SELECT_COLS =
  "id, rule_key, seq, priority, is_enabled, match_description_regex, match_merchant_regex, match_amount_greater_than, match_amount_abs_greater_than, route_target_account, route_memo";

export async function listRules(): Promise<ClassificationRule[]> {
  return rows<RuleDbRow>('SELECT * FROM classification_rules ORDER BY priority, seq').map(toRule);
}

// Normalize + validate, mapping the pure RuleValidationError to a 400 Response.
function normalizeInput(input: RuleInput): RuleInput {
  try {
    return normalizeRuleInput(input);
  } catch (err) {
    if (err instanceof RuleValidationError) {
      throwServerError(err.message, 400);
    }
    throw err;
  }
}

function dbFields(input: RuleInput) {
  return {
    rule_key: input.ruleKey,
    priority: Math.round(input.priority),
    is_enabled: input.isEnabled,
    match_description_regex: input.matchDescriptionRegex?.trim() || null,
    match_merchant_regex: input.matchMerchantRegex?.trim() || null,
    match_amount_greater_than: input.matchAmountGreaterThan,
    match_amount_abs_greater_than: input.matchAmountAbsGreaterThan,
    route_target_account: input.targetAccount,
    route_memo: input.memo?.trim() || null,
  };
}

export async function createRule(rawInput: RuleInput): Promise<ClassificationRule[]> {
  const input = normalizeInput(rawInput);
  atomic(() => {
    const seq = rows<{seq: number}>('SELECT COALESCE(MAX(seq), -1) + 1 AS seq FROM classification_rules')[0].seq;
    writeRecord('classification_rules', {...dbFields(input), seq});
  });
  return listRules();
}
export async function updateRule(id: string, rawInput: RuleInput): Promise<ClassificationRule[]> {
  const {rule_key: _key, ...fields} = dbFields(normalizeInput(rawInput));
  writeRecord('classification_rules', fields, id);
  return listRules();
}
export async function setRuleEnabled(id: string, enabled: boolean): Promise<ClassificationRule[]> {
  writeRecord('classification_rules', {is_enabled: enabled}, id);
  return listRules();
}
export async function deleteRule(id: string): Promise<ClassificationRule[]> {
  execute('DELETE FROM classification_rules WHERE id=?', id);
  return listRules();
}
