import { readFileSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import { fromAkahuPayload } from "./rawTransaction";
import { RulesRouter, type RulesConfig } from "./rulesRouter";

/**
 * Cross-language golden parity for the classification rules router. The TS port
 * must reproduce the Python engine's RulesRouter.route + account_mapping_for on
 * the pinned corpus. The "real"/default cases are evaluated against the frozen
 * tests/golden/fixtures/rules_snapshot.yaml (the same config the Python golden
 * suite pins), not the owner's evolving config/rules.yaml — see
 * tests/golden/README.md ("Why a frozen rules snapshot").
 */

const goldenDir = path.resolve(process.cwd(), "../tests/golden/fixtures");

const snapshotConfig = yaml.load(
  readFileSync(path.join(goldenDir, "rules_snapshot.yaml"), "utf-8"),
) as RulesConfig;
const defaultRouter = new RulesRouter(snapshotConfig);

function loadCases<T>(name: string): T[] {
  const parsed = JSON.parse(readFileSync(path.join(goldenDir, name), "utf-8")) as {
    cases: T[];
  };
  return parsed.cases;
}

interface RoutingExpected {
  target_account: string;
  rule_id: string | null;
  matched_by: string;
  memo: string | null;
}

interface RoutingCase {
  case_id: string;
  source: string;
  input: Record<string, unknown>;
  router_config?: RulesConfig;
  expected: RoutingExpected;
}

interface MappingExpected {
  ledger_account: string;
  account_type: string;
  credit_limit_cents: number | null;
}

interface MappingCase {
  case_id: string;
  source: string;
  input: { account_id: string };
  expected: MappingExpected;
}

describe("RulesRouter.route — golden parity vs Python engine", () => {
  const cases = loadCases<RoutingCase>("rules_routing.json");

  it("has a corpus to test", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  for (const c of cases) {
    it(`${c.case_id} (${c.source})`, () => {
      const router = c.router_config ? new RulesRouter(c.router_config) : defaultRouter;
      const txn = fromAkahuPayload(c.input);
      const decision = router.route(txn);

      expect(decision.targetAccount, "target_account").toBe(c.expected.target_account);
      expect(decision.ruleId, "rule_id").toBe(c.expected.rule_id);
      expect(decision.matchedBy, "matched_by").toBe(c.expected.matched_by);
      expect(decision.memo, "memo").toBe(c.expected.memo);
    });
  }
});

describe("RulesRouter.accountMappingFor — golden parity vs Python engine", () => {
  const cases = loadCases<MappingCase>("account_mapping.json");

  it("has a corpus to test", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  for (const c of cases) {
    it(`${c.case_id} (${c.source})`, () => {
      const mapping = defaultRouter.accountMappingFor(c.input.account_id);
      expect(mapping.ledgerAccount, "ledger_account").toBe(c.expected.ledger_account);
      expect(mapping.accountType, "account_type").toBe(c.expected.account_type);
      expect(mapping.creditLimitCents, "credit_limit_cents").toBe(
        c.expected.credit_limit_cents,
      );
    });
  }
});
