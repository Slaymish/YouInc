// The reflect-metadata polyfill (static import) must evaluate before any code
// from @simplewebauthn/server loads, because its @peculiar/x509 + tsyringe
// dependency runs Reflect.getMetadata decorators at import time. We therefore
// consume the polyfill flag here (so it is never tree-shaken) and import the
// WebAuthn library *lazily* inside each ceremony function — never statically,
// which the bundler would hoist ahead of the polyfill.
import { REFLECT_METADATA_LOADED } from "./reflect-polyfill";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { getCookie, getRequest, setCookie } from "@tanstack/react-start/server";

async function webauthn() {
  if (!REFLECT_METADATA_LOADED) {
    throw new Error("reflect-metadata polyfill did not load before WebAuthn init");
  }
  return import("@simplewebauthn/server");
}

// ponytail: single-user passkey auth. One credential, one live session at a
// time is all this app needs — no user table, no multi-device fan-out. Add a
// users table if this ever grows past one human.

const RP_NAME = "YouInc Ledger";
const SESSION_COOKIE = "youinc_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const USER_ID = "youinc-owner"; // stable single-user handle

function resolveAuthDbPath(): string {
  const configured = process.env.YOUINC_AUTH_DB_PATH ?? "../data/youinc-auth.sqlite3";
  return path.isAbsolute(configured)
    ? configured
    : path.resolve(process.cwd(), configured);
}

let dbInstance: Database.Database | null = null;

function db(): Database.Database {
  if (dbInstance) return dbInstance;
  const dbPath = resolveAuthDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const database = new Database(dbPath);
  database.pragma("journal_mode = WAL");
  database.exec(`
    CREATE TABLE IF NOT EXISTS credentials (
      id TEXT PRIMARY KEY,
      public_key BLOB NOT NULL,
      counter INTEGER NOT NULL,
      transports TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS challenges (
      purpose TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `);
  dbInstance = database;
  return database;
}

// --- Relying-party resolution -------------------------------------------------
// Derive rpID/origin from the incoming request by default so localhost and a
// deployed domain both work with zero config. Override via env when behind a
// reverse proxy that rewrites Host/Origin.

function resolveRp(): { rpID: string; origin: string } {
  const request = getRequest();
  const url = new URL(request.url);
  const originHeader = request.headers.get("origin") ?? url.origin;
  const rpID = process.env.YOUINC_RP_ID ?? new URL(originHeader).hostname;
  const origin = process.env.YOUINC_RP_ORIGIN ?? originHeader;
  return { rpID, origin };
}

// --- Challenge storage --------------------------------------------------------

function saveChallenge(purpose: "register" | "authenticate", value: string): void {
  db()
    .prepare(
      `INSERT INTO challenges (purpose, value, expires_at) VALUES (?, ?, ?)
       ON CONFLICT(purpose) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at`,
    )
    .run(purpose, value, Date.now() + CHALLENGE_TTL_MS);
}

function takeChallenge(purpose: "register" | "authenticate"): string | null {
  const row = db()
    .prepare(`SELECT value, expires_at FROM challenges WHERE purpose = ?`)
    .get(purpose) as { value: string; expires_at: number } | undefined;
  db().prepare(`DELETE FROM challenges WHERE purpose = ?`).run(purpose);
  if (!row || row.expires_at < Date.now()) return null;
  return row.value;
}

// --- Credential storage -------------------------------------------------------

interface StoredCredential {
  id: string;
  publicKey: Uint8Array<ArrayBuffer>;
  counter: number;
  transports: string[] | undefined;
}

// Copy DB bytes into a fresh ArrayBuffer-backed view so the type matches what
// @simplewebauthn expects (Uint8Array<ArrayBuffer>, not <ArrayBufferLike>).
function toBytes(buffer: Buffer): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(buffer.length);
  bytes.set(buffer);
  return bytes;
}

export function hasCredential(): boolean {
  const row = db().prepare(`SELECT COUNT(*) AS n FROM credentials`).get() as { n: number };
  return row.n > 0;
}

function listCredentials(): StoredCredential[] {
  const rows = db()
    .prepare(`SELECT id, public_key, counter, transports FROM credentials`)
    .all() as { id: string; public_key: Buffer; counter: number; transports: string | null }[];
  return rows.map((r) => ({
    id: r.id,
    publicKey: toBytes(r.public_key),
    counter: r.counter,
    transports: r.transports ? (JSON.parse(r.transports) as string[]) : undefined,
  }));
}

// --- Sessions -----------------------------------------------------------------

function issueSession(): void {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  db()
    .prepare(`INSERT INTO sessions (token, created_at, expires_at) VALUES (?, ?, ?)`)
    .run(token, now, now + SESSION_TTL_MS);
  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: (process.env.YOUINC_RP_ORIGIN ?? "").startsWith("https") || process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

/** Validate a session token (from a cookie). Safe to call from middleware. */
export function isValidSession(token: string | undefined | null): boolean {
  if (!token) return false;
  const row = db()
    .prepare(`SELECT expires_at FROM sessions WHERE token = ?`)
    .get(token) as { expires_at: number } | undefined;
  if (!row) return false;
  if (row.expires_at < Date.now()) {
    db().prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
    return false;
  }
  return true;
}

/** Guard for server functions: throws 401 unless the caller has a live session. */
export function requireSession(): void {
  if (!isValidSession(getCookie(SESSION_COOKIE))) {
    throw new Response("Unauthorized", { status: 401 });
  }
}

/** Whether the current request carries a live session cookie. Safe for public routes. */
export function hasValidSession(): boolean {
  return isValidSession(getCookie(SESSION_COOKIE));
}

/** Ends the current session: removes it from the store and clears the cookie. */
export function destroySession(): void {
  const token = getCookie(SESSION_COOKIE);
  if (token) {
    db().prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
  }
  setCookie(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: (process.env.YOUINC_RP_ORIGIN ?? "").startsWith("https") || process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

// --- Enrollment gate ----------------------------------------------------------
// Registration is disabled unless YOUINC_ENROLLMENT_TOKEN is set AND the caller
// supplies a matching value. Set it temporarily to enrol a passkey, then unset.

function enrollmentAllowed(suppliedToken: string): boolean {
  const expected = process.env.YOUINC_ENROLLMENT_TOKEN;
  if (!expected) return false;
  const a = Buffer.from(suppliedToken);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// --- Registration ceremony ----------------------------------------------------

export async function beginRegistration(
  enrollmentToken: string,
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  if (!enrollmentAllowed(enrollmentToken)) {
    throw new Response("Registration is disabled.", { status: 403 });
  }
  const { generateRegistrationOptions } = await webauthn();
  const { rpID } = resolveRp();
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userID: new TextEncoder().encode(USER_ID),
    userName: USER_ID,
    attestationType: "none",
    excludeCredentials: listCredentials().map((c) => ({ id: c.id })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
  });
  saveChallenge("register", options.challenge);
  return options;
}

export async function finishRegistration(
  response: RegistrationResponseJSON,
  enrollmentToken: string,
): Promise<{ verified: boolean }> {
  if (!enrollmentAllowed(enrollmentToken)) {
    throw new Response("Registration is disabled.", { status: 403 });
  }
  const { verifyRegistrationResponse } = await webauthn();
  const expectedChallenge = takeChallenge("register");
  if (!expectedChallenge) throw new Response("Challenge expired.", { status: 400 });
  const { rpID, origin } = resolveRp();

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: false,
  });

  if (!verification.verified || !verification.registrationInfo) {
    return { verified: false };
  }

  const { credential } = verification.registrationInfo;
  db()
    .prepare(
      `INSERT INTO credentials (id, public_key, counter, transports, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET public_key = excluded.public_key, counter = excluded.counter, transports = excluded.transports`,
    )
    .run(
      credential.id,
      Buffer.from(credential.publicKey),
      credential.counter,
      credential.transports ? JSON.stringify(credential.transports) : null,
      Date.now(),
    );

  issueSession();
  return { verified: true };
}

// --- Authentication ceremony --------------------------------------------------

export async function beginAuthentication(): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const { generateAuthenticationOptions } = await webauthn();
  const { rpID } = resolveRp();
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: listCredentials().map((c) => ({ id: c.id, transports: c.transports as never })),
    userVerification: "preferred",
  });
  saveChallenge("authenticate", options.challenge);
  return options;
}

export async function finishAuthentication(
  response: AuthenticationResponseJSON,
): Promise<{ verified: boolean }> {
  const { verifyAuthenticationResponse } = await webauthn();
  const expectedChallenge = takeChallenge("authenticate");
  if (!expectedChallenge) throw new Response("Challenge expired.", { status: 400 });

  const credential = listCredentials().find((c) => c.id === response.id);
  if (!credential) return { verified: false };

  const { rpID, origin } = resolveRp();
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: credential.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: credential.transports as never,
    },
    requireUserVerification: false,
  });

  if (!verification.verified) return { verified: false };

  db()
    .prepare(`UPDATE credentials SET counter = ? WHERE id = ?`)
    .run(verification.authenticationInfo.newCounter, credential.id);

  issueSession();
  return { verified: true };
}
