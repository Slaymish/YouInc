// Server-only waitlist store. Mirrors the auth.ts SQLite pattern: dedicated DB
// file, WAL, lazy singleton. The `leads` table is the source of truth; owner
// notification is best-effort and never fails a signup.
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { z } from "zod";

const WaitlistSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().max(120).optional(),
  interest: z.enum(["self-serve", "concierge"]).optional(),
  source: z.string().max(60).optional(),
  userAgent: z.string().max(400).optional(),
  // Honeypot: real users never fill this. Bots do.
  company: z.string().optional(),
});

export type WaitlistInput = z.infer<typeof WaitlistSchema>;

function resolveLeadsDbPath(): string {
  const configured = process.env.YOUINC_LEADS_DB_PATH ?? "../data/youinc-leads.sqlite3";
  return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
}

let dbInstance: Database.Database | null = null;

function db(): Database.Database {
  if (dbInstance) return dbInstance;
  const dbPath = resolveLeadsDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const database = new Database(dbPath);
  database.pragma("journal_mode = WAL");
  database.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      name TEXT,
      interest TEXT,
      source TEXT,
      user_agent TEXT,
      created_at INTEGER NOT NULL,
      UNIQUE(email)
    );
  `);
  dbInstance = database;
  return database;
}

function notify(lead: WaitlistInput): void {
  const url = process.env.YOUINC_LEADS_WEBHOOK_URL;
  console.info(`[waitlist] new signup: ${lead.email} (${lead.source ?? "unknown"})`);
  if (!url) return;
  // Fire-and-forget; a failed webhook must never fail the signup.
  void fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: lead.email, source: lead.source, interest: lead.interest }),
  }).catch((err) => console.error("[waitlist] webhook failed", err));
}

export function recordLead(input: unknown): { ok: true } {
  const parsed = WaitlistSchema.safeParse(input);
  if (!parsed.success) {
    throw new Response("Please enter a valid email address.", { status: 400 });
  }
  const lead = parsed.data;
  // Honeypot filled → pretend success, store nothing.
  if (lead.company && lead.company.trim().length > 0) {
    return { ok: true };
  }
  db()
    .prepare(
      `INSERT INTO leads (email, name, interest, source, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         name = excluded.name,
         interest = excluded.interest,
         source = excluded.source,
         user_agent = excluded.user_agent,
         created_at = excluded.created_at`,
    )
    .run(
      lead.email,
      lead.name ?? null,
      lead.interest ?? null,
      lead.source ?? null,
      lead.userAgent ?? null,
      Date.now(),
    );
  notify(lead);
  return { ok: true };
}
