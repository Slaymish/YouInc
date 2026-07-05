// Server-only, tenant-scoped Postgres pipeline-health read for the
// self-service /workspace dashboard (see workspaceDashboard.ts).
//
// The math (bucketing raw_transactions rows into posted/pending/zero-amount/
// unprocessed) lives in the dependency-free workspacePipelineMath.ts so it can
// be unit-tested without the Supabase client. This module's only job is
// fetching the tenant's raw_transactions status columns + the most recent
// akahu_connections.last_synced_at, both filtered by tenant_id under the
// caller's RLS-scoped client (never service_role) — matching the read
// pattern the rest of the workspace path uses (workspaceJournal.ts,
// workspaceLedger.ts).
import { getSupabaseServerClient } from "./supabaseServer";
import { throwServerError } from "./serverError";
import {
  computePipelineHealth,
  latestTimestamp,
  type PipelineHealth,
  type RawTransactionStatusRow,
} from "./workspacePipelineMath";

export type { PipelineHealth } from "./workspacePipelineMath";

interface RawTransactionStatusDbRow {
  transaction_date: string;
  processed_at: string | null;
  skipped_reason: string | null;
}

interface AkahuConnectionSyncDbRow {
  last_synced_at: string | null;
}

/** The caller's tenant pipeline health (raw-ingestion funnel + last sync time). */
export async function getWorkspacePipelineHealth(tenantId: string): Promise<PipelineHealth> {
  const supabase = getSupabaseServerClient();

  const [rawRes, akahuRes] = await Promise.all([
    supabase
      .from("raw_transactions")
      .select("transaction_date, processed_at, skipped_reason")
      .eq("tenant_id", tenantId),
    supabase.from("akahu_connections").select("last_synced_at").eq("tenant_id", tenantId),
  ]);
  if (rawRes.error) {
    throwServerError(rawRes.error.message || "Could not load pipeline health.", 400);
  }
  if (akahuRes.error) {
    throwServerError(akahuRes.error.message || "Could not load sync status.", 400);
  }

  const rows: RawTransactionStatusRow[] = ((rawRes.data ?? []) as RawTransactionStatusDbRow[]).map(
    (r) => ({
      transactionDate: r.transaction_date,
      processedAt: r.processed_at,
      skippedReason: r.skipped_reason,
    }),
  );
  const lastSeenAt = latestTimestamp(
    ((akahuRes.data ?? []) as AkahuConnectionSyncDbRow[]).map((r) => r.last_synced_at),
  );

  return computePipelineHealth(rows, lastSeenAt);
}
