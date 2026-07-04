import { vi } from "vitest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

let dir: string;
let dbPath: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "leads-"));
  dbPath = path.join(dir, "leads.sqlite3");
  process.env.YOUINC_LEADS_DB_PATH = dbPath;
});

afterEach(() => {
  delete process.env.YOUINC_LEADS_DB_PATH;
  rmSync(dir, { recursive: true, force: true });
  vi.resetModules();
});

async function freshModule() {
  vi.resetModules();
  return import("./leads");
}

function countRows(): number {
  if (!existsSync(dbPath)) {
    return 0;
  }
  const db = new Database(dbPath, { readonly: true });
  const row = db.prepare("SELECT COUNT(*) AS n FROM leads").get() as { n: number };
  db.close();
  return row.n;
}

describe("recordLead", () => {
  it("stores a valid signup", async () => {
    const { recordLead } = await freshModule();
    expect(recordLead({ email: "a@b.com", source: "hero" })).toEqual({ ok: true });
    expect(countRows()).toBe(1);
  });

  it("is idempotent on duplicate email (upsert, not a second row)", async () => {
    const { recordLead } = await freshModule();
    recordLead({ email: "dup@b.com", source: "hero" });
    recordLead({ email: "dup@b.com", source: "pricing" });
    expect(countRows()).toBe(1);
  });

  it("rejects an invalid email with a catchable 400 ServerFnError", async () => {
    const { recordLead } = await freshModule();
    try {
      recordLead({ email: "not-an-email" });
      expect.unreachable("should have thrown");
    } catch (err) {
      // A catchable Error (not a raw Response — see server/serverError.ts),
      // carrying the original status as a plain own property.
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).name).toBe("ServerFnError");
      expect((err as Error & { status: number }).status).toBe(400);
    }
    expect(countRows()).toBe(0);
  });

  it("normalizes email case so the same address dedupes", async () => {
    const { recordLead } = await freshModule();
    recordLead({ email: "Jane@Example.com", source: "hero" });
    recordLead({ email: "jane@example.com", source: "pricing" });
    expect(countRows()).toBe(1);
  });

  it("silently drops honeypot submissions without storing", async () => {
    const { recordLead } = await freshModule();
    expect(recordLead({ email: "bot@b.com", company: "Acme Spam" })).toEqual({ ok: true });
    expect(countRows()).toBe(0);
  });

  it("rejects a honeypot value over 200 chars with a catchable 400 ServerFnError", async () => {
    const { recordLead } = await freshModule();
    try {
      recordLead({ email: "bot@b.com", company: "x".repeat(201) });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).name).toBe("ServerFnError");
      expect((err as Error & { status: number }).status).toBe(400);
    }
    expect(countRows()).toBe(0);
  });
});
