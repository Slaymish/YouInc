import type { ProductAnalyticsEventName } from "~/server/productAnalyticsValidation";

const ANONYMOUS_ID_KEY = "youinc.analytics.anonymous-id.v1";
const SESSION_KEY = "youinc.analytics.session.v1";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

interface StoredSession {
  id: string;
  touchedAt: number;
}

function storedUuid(key: string): string {
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(key, created);
  return created;
}

function sessionId(now = Date.now()): string {
  try {
    const stored = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as StoredSession | null;
    if (stored && now - stored.touchedAt < SESSION_TIMEOUT_MS) {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ id: stored.id, touchedAt: now }));
      return stored.id;
    }
  } catch {
    // A malformed local value should start a clean analytics session.
  }
  const id = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, JSON.stringify({ id, touchedAt: now }));
  return id;
}

/** Fire-and-forget product telemetry. Failures never interrupt the user flow. */
export function trackProductEvent(
  eventName: ProductAnalyticsEventName,
  properties: Record<string, string> = {},
): void {
  if (typeof window === "undefined") return;

  try {
    const event = {
      eventName,
      anonymousId: storedUuid(ANONYMOUS_ID_KEY),
      sessionId: sessionId(),
      properties,
    };
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true,
    });
  } catch (error) {
    if (import.meta.env.DEV) console.warn("[analytics] event discarded", error);
  }
}
