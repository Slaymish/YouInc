import { z } from "zod";

export const ANALYTICS_PROPERTY_KEYS = {
  marketing_cta_clicked: ["placement"],
  signup_started: ["entrypoint"],
  onboarding_started: [],
  sample_data_loaded: ["source"],
  akahu_connect_started: ["source"],
  akahu_oauth_failed: ["reason"],
  dashboard_viewed: [],
  settings_opened: [],
} as const;

const ANALYTICS_PROPERTY_VALUES: Record<
  ProductAnalyticsEventName,
  Partial<Record<string, readonly string[]>>
> = {
  marketing_cta_clicked: { placement: ["pricing-table", "quiz-reveal"] },
  signup_started: { entrypoint: ["signup"] },
  onboarding_started: {},
  sample_data_loaded: { source: ["workspace"] },
  akahu_connect_started: { source: ["settings"] },
  akahu_oauth_failed: { reason: ["denied", "state", "identity", "exchange"] },
  dashboard_viewed: {},
  settings_opened: {},
};

export type ProductAnalyticsEventName = keyof typeof ANALYTICS_PROPERTY_KEYS;

export interface ProductAnalyticsEvent {
  eventName: ProductAnalyticsEventName;
  anonymousId?: string;
  sessionId?: string;
  properties: Record<string, string>;
}

const EventEnvelopeSchema = z.object({
  eventName: z.string(),
  anonymousId: z.uuid().optional(),
  sessionId: z.uuid().optional(),
  properties: z.record(z.string(), z.unknown()).default({}),
});

/** Strictly validates the small, privacy-safe browser event contract. */
export function validateAnalyticsEvent(input: unknown): ProductAnalyticsEvent {
  const envelope = EventEnvelopeSchema.parse(input);
  if (!(envelope.eventName in ANALYTICS_PROPERTY_KEYS)) {
    throw new Error("Unknown analytics event.");
  }

  const eventName = envelope.eventName as ProductAnalyticsEventName;
  const allowedKeys = ANALYTICS_PROPERTY_KEYS[eventName] as readonly string[];
  const properties: Record<string, string> = {};
  for (const [key, value] of Object.entries(envelope.properties)) {
    if (!allowedKeys.includes(key)) {
      throw new Error(`Unknown property for analytics event: ${key}`);
    }
    const allowedValues = ANALYTICS_PROPERTY_VALUES[eventName][key];
    if (typeof value !== "string" || !allowedValues?.includes(value)) {
      throw new Error(`Invalid analytics property value: ${key}`);
    }
    properties[key] = value;
  }

  return {
    eventName,
    ...(envelope.anonymousId ? { anonymousId: envelope.anonymousId } : {}),
    ...(envelope.sessionId ? { sessionId: envelope.sessionId } : {}),
    properties,
  };
}
