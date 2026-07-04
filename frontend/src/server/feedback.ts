// Server-only feedback store. Mirrors leads.ts exactly: dedicated DB file,
// WAL, lazy singleton. The `feedback` table is the source of truth; owner
// notification is best-effort and never fails the write.
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
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

function resolveFeedbackDbPath(): string {
  const configured = process.env.YOUINC_FEEDBACK_DB_PATH ?? "../data/youinc-feedback.sqlite3";
  return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
}

let dbInstance: Database.Database | null = null;

function db(): Database.Database {
  if (dbInstance) return dbInstance;
  const dbPath = resolveFeedbackDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const database = new Database(dbPath);
  database.pragma("journal_mode = WAL");
  database.exec(`
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vote TEXT NOT NULL,
      note TEXT,
      variant TEXT NOT NULL,
      source TEXT NOT NULL,
      path TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  dbInstance = database;
  return database;
}

function notify(feedback: FeedbackInput): void {
  const url = process.env.YOUINC_FEEDBACK_WEBHOOK_URL;
  console.info(`[feedback] ${feedback.vote} vote on ${feedback.path} (variant ${feedback.variant})`);
  if (!url) return;
  // Fire-and-forget; a failed webhook must never fail the submission.
  void fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(feedback),
  }).catch((err) => console.error("[feedback] webhook failed", err));
}

export function recordFeedback(input: unknown): { ok: true } {
  const parsed = FeedbackSchema.safeParse(input);
  if (!parsed.success) {
    throwServerError("Invalid feedback payload.", 400);
  }
  const feedback = parsed.data;
  db()
    .prepare(
      `INSERT INTO feedback (vote, note, variant, source, path, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      feedback.vote,
      feedback.note ?? null,
      feedback.variant,
      feedback.source,
      feedback.path,
      Date.now(),
    );
  notify(feedback);
  return { ok: true };
}
