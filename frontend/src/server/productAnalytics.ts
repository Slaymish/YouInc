import { z } from "zod";
import { getSupabaseServerClient } from "./supabaseServer";
import { throwServerError } from "./serverError";
import {
  validateAnalyticsEvent,
  type ProductAnalyticsEventName,
} from "./productAnalyticsValidation";

const INSUFFICIENT_PRIVILEGE_ERRCODE = "42501";

const ProductAnalyticsSummarySchema = z.object({
  since: z.string(),
  generated_at: z.string(),
  kpis: z.object({
    engaged_workspaces_7d: z.coerce.number(),
    workspaces_created: z.coerce.number(),
    activation_eligible_workspaces: z.coerce.number(),
    workspaces_created_7d: z.coerce.number(),
    activated_workspaces: z.coerce.number(),
    activation_rate: z.coerce.number().nullable(),
    sync_succeeded: z.coerce.number(),
    sync_failed: z.coerce.number(),
    sync_success_rate: z.coerce.number().nullable(),
  }),
  funnel: z.array(z.object({
    event_name: z.string(),
    label: z.string(),
    count: z.coerce.number(),
  })),
  top_events: z.array(z.object({
    event_name: z.string(),
    label: z.string(),
    count: z.coerce.number(),
  })),
  daily: z.array(z.object({
    date: z.string(),
    count: z.coerce.number(),
  })),
});

export type ProductAnalyticsSummary = z.infer<typeof ProductAnalyticsSummarySchema>;

export async function recordProductEvent(input: unknown): Promise<void> {
  const event = validateAnalyticsEvent(input);
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.rpc("record_analytics_event", {
    p_event_name: event.eventName,
    p_anonymous_id: event.anonymousId ?? null,
    p_session_id: event.sessionId ?? null,
    p_properties: event.properties,
  });
  if (error) {
    console.error("[analytics] record_analytics_event failed", error);
    throwServerError("Could not record analytics event.", 500);
  }
}

export async function recordServerProductEvent(
  eventName: ProductAnalyticsEventName,
  properties: Record<string, string> = {},
): Promise<void> {
  return recordProductEvent({ eventName, properties });
}

export async function getProductAnalyticsSummary(
  since?: string,
): Promise<ProductAnalyticsSummary> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("product_analytics_summary", {
    p_since: since ?? null,
  });
  if (error) {
    if (error.code === INSUFFICIENT_PRIVILEGE_ERRCODE) {
      throwServerError("Not authorized to view product analytics.", 403);
    }
    console.error("[analytics] product_analytics_summary failed", error);
    throwServerError("Could not load product analytics.", 500);
  }

  const parsed = ProductAnalyticsSummarySchema.safeParse(data);
  if (!parsed.success) {
    console.error("[analytics] unexpected summary shape", parsed.error);
    throwServerError("Could not load product analytics.", 500);
  }
  return parsed.data;
}
