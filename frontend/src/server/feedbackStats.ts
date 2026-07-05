// Server-only, admin-only feedback-variant statistics (see todo.md "IN
// PROGRESS: Variant voting — make it useful"). Reads go through the
// feedback_variant_stats SECURITY DEFINER RPC (see
// supabase/migrations/<TS>_feedback_variant_stats_rpc.sql), which
// self-enforces admin-only access via is_app_admin() inside the function
// body before touching `feedback` — there is no service_role client and no
// app-layer secret in this codebase (see supabaseServer.ts); authorization
// lives in Postgres. A signed-in non-admin caller gets a clean 403 here,
// mirroring the "two independent layers must agree" design in the design doc.
//
// Like feedback.ts, this module is a plain server-only helper (no
// createServerFn here) — the codebase's actual convention wraps
// createServerFn at the calling component/route, which lazily
// `await import()`s this module inside its `.handler()` (see
// components/marketing/FeedbackWidget.tsx's submitFeedback wrapping
// recordFeedback). The future /admin/feedback route (T5) should follow that
// same shape when it wires this up.
import { z } from "zod";
import { getSupabaseServerClient } from "./supabaseServer";
import { throwServerError } from "./serverError";
import {
  pickLeader,
  type LeaderResult,
  type ProportionSample,
  type VariantAggregate,
} from "../lib/variantStats";

/** Postgres errcode for insufficient_privilege, raised by is_app_admin() gating. */
const INSUFFICIENT_PRIVILEGE_ERRCODE = "42501";

// Wire-shape (snake_case, straight off the RPC) before mapping to camelCase.
// bigint/numeric columns can come back as either JSON numbers or strings
// depending on the PostgREST/driver version, so coerce defensively.
const FeedbackVariantStatsRowSchema = z.object({
  variant: z.string(),
  source: z.string(),
  path: z.string(),
  up_count: z.coerce.number(),
  down_count: z.coerce.number(),
  total: z.coerce.number(),
  up_rate: z.coerce.number(),
});

const FeedbackVariantStatsRowsSchema = z.array(FeedbackVariantStatsRowSchema);

export interface FeedbackVariantStatsInput {
  since?: string;
}

export interface FeedbackVariantStatsResult {
  aggregates: VariantAggregate[];
  leader: LeaderResult;
}

function toAggregate(
  row: z.infer<typeof FeedbackVariantStatsRowSchema>,
): VariantAggregate {
  return {
    variant: row.variant,
    source: row.source,
    path: row.path,
    upCount: row.up_count,
    downCount: row.down_count,
    total: row.total,
    upRate: row.up_rate,
  };
}

/** Pool per-variant totals across source/path so pickLeader compares variant vs. variant overall. */
function poolByVariant(
  aggregates: VariantAggregate[],
): Record<string, ProportionSample> {
  const pooled: Record<string, ProportionSample> = {};
  for (const aggregate of aggregates) {
    const existing = pooled[aggregate.variant] ?? { upCount: 0, total: 0 };
    pooled[aggregate.variant] = {
      upCount: existing.upCount + aggregate.upCount,
      total: existing.total + aggregate.total,
    };
  }
  return pooled;
}

/**
 * Admin-only aggregate feedback stats, grouped by variant/source/path, plus
 * a computed statistical leader (see lib/variantStats.ts). Throws a 403 when
 * the RPC denies the caller (not an admin); throws a 500 on any other
 * failure. Never leaks internal Postgres error details to the caller.
 */
export async function getFeedbackVariantStats(
  input?: FeedbackVariantStatsInput,
): Promise<FeedbackVariantStatsResult> {
  const supabase = getSupabaseServerClient();
  // NOTE: `p_since` must match the SQL function's parameter name exactly —
  // public.feedback_variant_stats(p_since timestamptz default null).
  const { data, error } = await supabase.rpc("feedback_variant_stats", {
    p_since: input?.since ?? null,
  });

  if (error) {
    if (error.code === INSUFFICIENT_PRIVILEGE_ERRCODE) {
      console.error(
        "[feedback-stats] caller denied by feedback_variant_stats (not an admin)",
        error,
      );
      throwServerError("Not authorized to view feedback stats.", 403);
    }
    console.error("[feedback-stats] feedback_variant_stats failed", error);
    throwServerError("Could not load feedback stats.", 500);
  }

  const parsed = FeedbackVariantStatsRowsSchema.safeParse(data ?? []);
  if (!parsed.success) {
    console.error("[feedback-stats] unexpected RPC row shape", parsed.error);
    throwServerError("Could not load feedback stats.", 500);
  }

  const aggregates = parsed.data.map(toAggregate);
  const leader = pickLeader(poolByVariant(aggregates));

  console.info(`[feedback-stats] loaded ${aggregates.length} aggregate row(s)`);
  return { aggregates, leader };
}
