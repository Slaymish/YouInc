// Minimal transactional email sender (Resend HTTP API over fetch — no SDK
// dependency). Env-driven and fail-soft: if RESEND_API_KEY / EMAIL_FROM aren't
// configured it no-ops with a log rather than throwing, so dev, tests, and any
// deploy without email set up all keep working. Swap providers by changing only
// this file. `buildResendPayload` is pure so it can be unit-tested.
import { throwServerError } from "./serverError";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface ResendPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
}

export interface SendResult {
  sent: boolean;
  id?: string;
  error?: string;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function buildResendPayload(from: string, msg: EmailMessage): ResendPayload {
  return { from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text };
}

export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.info("[email] skipped — RESEND_API_KEY / EMAIL_FROM not configured");
    return { sent: false };
  }
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildResendPayload(from, msg)),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[email] send failed ${res.status}: ${detail}`);
      return { sent: false, error: `HTTP ${res.status}` };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { sent: true, id: data.id };
  } catch (err) {
    console.error("[email] send threw", err);
    return { sent: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

/** Assert email is configured — used by callers that must not silently no-op. */
export function requireEmailConfigured(): void {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    throwServerError("Email is not configured on this server.", 503);
  }
}
