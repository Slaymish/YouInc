import { pyTruthy } from "./rawTransaction";
import type { RawTransaction } from "./rawTransaction";

/**
 * TypeScript port of youinc_ledger.rules_router.rules (RulesRouter.route +
 * account_mapping_for) — P2 ledger port. Proven at parity against the Python
 * engine by tests/golden/fixtures/rules_routing.json + account_mapping.json
 * (see rulesRouter.golden.test.ts), evaluated against the frozen
 * tests/golden/fixtures/rules_snapshot.yaml.
 *
 * Deliberately no `from_file`/YAML loader here (Python has one): in the
 * multi-tenant target the config is per-tenant data loaded from the DB, so a
 * file loader would be dead weight. The router takes a plain config object,
 * matching Python's `__init__(config)`. The golden test parses the frozen YAML
 * snapshot into that object with js-yaml.
 *
 * Parity watch-outs reproduced here:
 *  - Python `if match.get(...)` truthiness for account_ids/currencies/regexes/
 *    nzfcc-codes (empty list/string is skipped), vs bare key-presence (`in`)
 *    for the amount_* thresholds (so a threshold of 0 is honoured, not skipped).
 *  - Exact Decimal amount comparison via BigInt (amount == amountCents/100),
 *    never binary float — a threshold like 1000.00 must compare exactly.
 *  - Python `re.search` with a leading inline flag group `(?i)`, which V8
 *    rejects outright (bare and scoped). We strip the leading flag group and
 *    map i/m/s to native RegExp flags; anything else throws rather than
 *    silently dropping (a dropped flag would masquerade as an inherent
 *    divergence while actually changing match results).
 *  - Priority sort is (int(priority) default 1000, original declaration index);
 *    a lower priority number wins, ties break on declaration order.
 */

export interface AccountMapping {
  ledgerAccount: string;
  accountType: string;
  /** Credit limit for revolving liabilities (credit cards); null otherwise. */
  creditLimitCents: number | null;
}

export type MatchedBy = "rule" | "nzfcc" | "suspense" | "manual";

export interface RouteDecision {
  targetAccount: string;
  ruleId: string | null;
  memo: string | null;
  matchedBy: MatchedBy;
}

interface Rule {
  id?: unknown;
  priority?: unknown;
  match?: Record<string, unknown>;
  route?: Record<string, unknown>;
}

export interface RulesConfig {
  defaults?: Record<string, unknown> | null;
  rules?: Rule[] | null;
  nzfcc_mappings?: Record<string, unknown> | null;
  account_mappings?: Record<string, unknown> | null;
}

const DEFAULT_PRIORITY = 1000;
const DEFAULT_SUSPENSE = "Expenses:Uncategorized:Suspense";
const UNMAPPED_SANITIZE = /[^A-Za-z0-9_:-]/g;

function hasOwn(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Compare amount (== cents/100, an exact 2dp decimal) against a decimal
 * threshold string, returning sign(amount - threshold). Pure integer BigInt
 * arithmetic — no binary-float error. Mirrors Python `Decimal` ordering.
 */
export function compareCentsToDecimal(cents: number, threshold: string): number {
  let body = threshold.trim();
  let negative = false;
  if (body.startsWith("-")) {
    negative = true;
    body = body.slice(1);
  } else if (body.startsWith("+")) {
    body = body.slice(1);
  }
  const [intPart = "0", fracPart = ""] = body.split(".");
  const digits = (intPart === "" ? "0" : intPart) + fracPart;
  let tNum = BigInt(digits === "" ? "0" : digits);
  if (negative) tNum = -tNum;
  const tDen = 10n ** BigInt(fracPart.length);

  // amount = cents / 100. Compare cents/100 vs tNum/tDen by cross-multiplying
  // (both denominators positive): cents * tDen  vs  tNum * 100.
  const lhs = BigInt(cents) * tDen;
  const rhs = tNum * 100n;
  return lhs < rhs ? -1 : lhs > rhs ? 1 : 0;
}

/**
 * Compile a Python-style pattern (`re.search` semantics) to a native RegExp.
 * Strips a leading inline flag group `(?flags)` and maps i/m/s. No g/y flag so
 * cached `.test()` stays stateless. Throws on any flag we don't map.
 */
function translatePythonRegex(pattern: string): RegExp {
  let body = pattern;
  let flags = "";
  const leading = /^\(\?([a-zA-Z]+)\)/.exec(body);
  if (leading) {
    body = body.slice(leading[0].length);
    for (const flag of leading[1]) {
      if (flag === "i" || flag === "m" || flag === "s") {
        if (!flags.includes(flag)) flags += flag;
      } else {
        throw new Error(
          `Unsupported inline regex flag '(?${leading[1]})' in pattern: ${pattern}`,
        );
      }
    }
  }
  return new RegExp(body, flags);
}

export class RulesRouter {
  private readonly defaults: Record<string, unknown>;
  private readonly sortedRules: ReadonlyArray<readonly [number, Rule]>;
  private readonly nzfccMappings: Record<string, unknown>;
  private readonly accountMappings: Record<string, unknown>;
  private readonly regexCache = new Map<string, RegExp>();

  constructor(config: RulesConfig) {
    this.defaults = (config.defaults ?? {}) as Record<string, unknown>;
    const rules = (config.rules ?? []) as Rule[];
    // sorted(enumerate(rules), key=(int(priority default 1000), index)).
    // JS sort is stable, and the explicit index tiebreak makes it doubly so.
    this.sortedRules = rules
      .map((rule, index) => [index, rule] as const)
      .sort((a, b) => {
        const pa = priorityOf(a[1]);
        const pb = priorityOf(b[1]);
        return pa !== pb ? pa - pb : a[0] - b[0];
      });
    this.nzfccMappings = (config.nzfcc_mappings ?? {}) as Record<string, unknown>;
    this.accountMappings = (config.account_mappings ?? {}) as Record<string, unknown>;
  }

  get suspenseAccount(): string {
    return String(this.defaults["suspense_account"] ?? DEFAULT_SUSPENSE);
  }

  accountMappingFor(accountId: string): AccountMapping {
    const raw = this.accountMappings[accountId];
    if (pyTruthy(raw)) {
      const entry = raw as Record<string, unknown>;
      if (!hasOwn(entry, "ledger_account")) {
        // Python does raw["ledger_account"] → KeyError on a malformed mapping.
        throw new Error(`account mapping for ${accountId} is missing ledger_account`);
      }
      const creditLimit = hasOwn(entry, "credit_limit_cents")
        ? entry["credit_limit_cents"]
        : null;
      return {
        ledgerAccount: String(entry["ledger_account"]),
        accountType: String(
          hasOwn(entry, "account_type") ? entry["account_type"] : "asset",
        ).toLowerCase(),
        creditLimitCents:
          creditLimit === null || creditLimit === undefined
            ? null
            : Math.trunc(Number(creditLimit)),
      };
    }
    const safeId = accountId.replace(UNMAPPED_SANITIZE, "_");
    return {
      ledgerAccount: `Assets:Unmapped:${safeId}`,
      accountType: "asset",
      creditLimitCents: null,
    };
  }

  route(transaction: RawTransaction): RouteDecision {
    for (const [, rule] of this.sortedRules) {
      const match = (rule.match ?? {}) as Record<string, unknown>;
      if (this.matches(match, transaction)) {
        const route = (rule.route ?? {}) as Record<string, unknown>;
        return {
          targetAccount: String(route["target_account"]),
          ruleId: String(rule.id),
          memo: (route["memo"] ?? null) as string | null,
          matchedBy: "rule",
        };
      }
    }

    if (pyTruthy(transaction.nzfcc)) {
      const nzfccRoute = this.nzfccMappings[transaction.nzfcc as string];
      if (pyTruthy(nzfccRoute)) {
        const route = nzfccRoute as Record<string, unknown>;
        return {
          targetAccount: String(route["target_account"]),
          ruleId: `nzfcc:${transaction.nzfcc}`,
          memo: null,
          matchedBy: "nzfcc",
        };
      }
    }

    return {
      targetAccount: this.suspenseAccount,
      ruleId: null,
      memo: null,
      matchedBy: "suspense",
    };
  }

  private matches(match: Record<string, unknown>, txn: RawTransaction): boolean {
    const description = txn.description || "";
    const merchant = txn.merchantName || "";
    const amountCents = txn.amountCents;
    const absCents = Math.abs(amountCents);

    const accountIds = match["account_ids"];
    if (pyTruthy(accountIds)) {
      if (!(accountIds as unknown[]).includes(txn.accountId)) return false;
    }

    const currencies = match["currencies"];
    if (pyTruthy(currencies)) {
      if (!(currencies as unknown[]).includes(txn.currency)) return false;
    }

    const descriptionRegex = match["description_regex"];
    if (pyTruthy(descriptionRegex)) {
      if (!this.compileRegex(String(descriptionRegex)).test(description)) return false;
    }

    const merchantRegex = match["merchant_regex"];
    if (pyTruthy(merchantRegex)) {
      if (!this.compileRegex(String(merchantRegex)).test(merchant)) return false;
    }

    const nzfccCodes = match["nzfcc"];
    if (pyTruthy(nzfccCodes)) {
      const expected = (nzfccCodes as unknown[]).map(String);
      if (txn.nzfcc === null || !expected.includes(txn.nzfcc)) return false;
    }

    // amount_* use key-presence (`in`), NOT truthiness: a threshold of 0 counts.
    if (hasOwn(match, "amount_greater_than")) {
      if (compareCentsToDecimal(amountCents, String(match["amount_greater_than"])) <= 0)
        return false;
    }
    if (hasOwn(match, "amount_less_than")) {
      if (compareCentsToDecimal(amountCents, String(match["amount_less_than"])) >= 0)
        return false;
    }
    if (hasOwn(match, "amount_abs_greater_than")) {
      if (compareCentsToDecimal(absCents, String(match["amount_abs_greater_than"])) <= 0)
        return false;
    }
    if (hasOwn(match, "amount_abs_less_than")) {
      if (compareCentsToDecimal(absCents, String(match["amount_abs_less_than"])) >= 0)
        return false;
    }

    return true;
  }

  private compileRegex(pattern: string): RegExp {
    const cached = this.regexCache.get(pattern);
    if (cached) return cached;
    const compiled = translatePythonRegex(pattern);
    this.regexCache.set(pattern, compiled);
    return compiled;
  }
}

function priorityOf(rule: Rule): number {
  return Math.trunc(Number(rule.priority ?? DEFAULT_PRIORITY));
}
