// Server-only lead capture. Writes go to Supabase via the record_lead
// SECURITY DEFINER RPC (see supabase/migrations/20260705120000). No local disk.
import { getSupabaseServerClient } from "./supabaseServer";
import { throwServerError } from "./serverError";
import { validateLead, type WaitlistInput } from "./leadsValidation";

export { validateLead, type WaitlistInput } from "./leadsValidation";

function notify(lead: WaitlistInput): void {
  const url = process.env.YOUINC_LEADS_WEBHOOK_URL;
  console.info(`[waitlist] new signup: ${lead.email} (${lead.source ?? "unknown"})`);
  if (!url) return;
  void fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: lead.email, source: lead.source, interest: lead.interest }),
  }).catch((err) => console.error("[waitlist] webhook failed", err));
}

export async function recordLead(input: unknown): Promise<{ ok: true }> {
  const result = validateLead(input);
  if ("skip" in result) return { ok: true };
  const { lead } = result;

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.rpc("record_lead", {
    p_email: lead.email,
    p_name: lead.name ?? null,
    p_interest: lead.interest ?? null,
    p_source: lead.source ?? null,
    p_user_agent: lead.userAgent ?? null,
  });
  if (error) {
    console.error("[waitlist] record_lead failed", error);
    throwServerError("Could not record your details. Please try again.", 500);
  }
  notify(lead);
  return { ok: true };
}
