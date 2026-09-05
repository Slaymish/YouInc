import { rows } from "./database";
import {
  computePipelineHealth,
  latestTimestamp,
  type PipelineHealth,
  type RawTransactionStatusRow,
} from "./workspacePipelineMath";

export type { PipelineHealth } from "./workspacePipelineMath";

export async function getWorkspacePipelineHealth(_workspaceId: string): Promise<PipelineHealth> {
  const raw = rows<RawTransactionStatusRow>(`SELECT transaction_date AS transactionDate,
    processed_at AS processedAt, skipped_reason AS skippedReason FROM raw_transactions`);
  const sync = rows<{finished_at: string}>("SELECT finished_at FROM akahu_sync_log WHERE status='success'");
  return computePipelineHealth(raw, latestTimestamp(sync.map(r => r.finished_at)));
}
