// Server-only feedback capture. Writes go to Supabase via the record_feedback
// SECURITY DEFINER RPC (see supabase/migrations/20260705120000). No local disk.
import { getSupabaseServerClient } from "./supabaseServer";
import { throwServerError } from "./serverError";
import { validateFeedback, type FeedbackInput } from "./feedbackValidation";

export { validateFeedback, type FeedbackInput } from "./feedbackValidation";

function notify(feedback: FeedbackInput): void {
  const url = process.env.YOUINC_FEEDBACK_WEBHOOK_URL;
  console.info(`[feedback] ${feedback.vote} vote on ${feedback.path} (variant ${feedback.variant})`);
  if (!url) return;
  void fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(feedback),
  }).catch((err) => console.error("[feedback] webhook failed", err));
}

export async function recordFeedback(input: unknown): Promise<{ ok: true }> {
  const feedback = validateFeedback(input);
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.rpc("record_feedback", {
    p_vote: feedback.vote,
    p_note: feedback.note ?? null,
    p_variant: feedback.variant,
    p_source: feedback.source,
    p_path: feedback.path,
  });
  if (error) {
    console.error("[feedback] record_feedback failed", error);
    throwServerError("Could not record feedback.", 500);
  }
  notify(feedback);
  return { ok: true };
}
