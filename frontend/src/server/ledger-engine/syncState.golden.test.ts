import { readFileSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import { RulesRouter, type RulesConfig } from "./rulesRouter";
import { LedgerPipeline } from "./pipeline";
import { InMemoryLedgerStore } from "./inMemoryLedgerStore";
import { resolveSyncMarker, syncStateKey } from "./syncState";

/**
 * Cross-language golden parity for the incremental-sync cursor. The TS port
 * must reproduce cmd_sync's key format and marker advancement:
 *  - sync_state_value = end_date or max payload date (settlement/settled/date).
 *  - exit_code        = 1 if the pipeline reported errors else 0.
 * The exit code is derived by running the already-ported pipeline over the
 * batch (with the frozen rules_snapshot.yaml), mirroring cmd_sync's own
 * `return 1 if result.errors else 0`, rather than re-implementing it.
 */

const goldenDir = path.resolve(process.cwd(), "../tests/golden/fixtures");
const EXAMPLE_ACCOUNT_ID = "acc_sync_example";

const snapshotConfig = yaml.load(
  readFileSync(path.join(goldenDir, "rules_snapshot.yaml"), "utf-8"),
) as RulesConfig;

interface KeyCase {
  case_id: string;
  source: string;
  expected: { key: string };
}

interface MarkerCase {
  case_id: string;
  source: string;
  input: {
    payloads: Record<string, unknown>[];
    account_id: string;
    end_date: string | null;
  };
  expected: { exit_code: number; sync_state_value: string };
}

type SyncCase = KeyCase | MarkerCase;

const cases = (
  JSON.parse(readFileSync(path.join(goldenDir, "sync_state.json"), "utf-8")) as {
    cases: SyncCase[];
  }
).cases;

function isMarkerCase(c: SyncCase): c is MarkerCase {
  return "input" in c;
}

/** cmd_sync's exit code: 1 if the pipeline reported errors, else 0. */
function syncExitCode(payloads: Record<string, unknown>[]): number {
  const pipeline = new LedgerPipeline(
    new InMemoryLedgerStore(),
    new RulesRouter(snapshotConfig),
    true,
  );
  return pipeline.processPayloads(payloads).errors.length > 0 ? 1 : 0;
}

describe("cmd_sync cursor — golden parity vs Python engine", () => {
  it("has a corpus to test", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  for (const c of cases) {
    it(`${c.case_id} (${c.source})`, () => {
      if (!isMarkerCase(c)) {
        expect(syncStateKey(EXAMPLE_ACCOUNT_ID)).toBe(c.expected.key);
        return;
      }

      expect(resolveSyncMarker(c.input.end_date, c.input.payloads), "sync_state_value").toBe(
        c.expected.sync_state_value,
      );
      expect(syncExitCode(c.input.payloads), "exit_code").toBe(c.expected.exit_code);
      // The persisted key is always last_sync:{account_id}.
      expect(syncStateKey(c.input.account_id)).toBe(`last_sync:${c.input.account_id}`);
    });
  }
});
