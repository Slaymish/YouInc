// Day-12 trial-reminder job. Driven by the secret-guarded cron route
// (routes/api.cron.trial-reminders.ts) on a daily schedule. Uses the SERVICE
// ROLE client (RLS bypass) because it runs with no user session and must read
// across all tenants + resolve owner emails via auth.admin. Idempotent: only
// tenants with trial_reminded_at IS NULL are considered, and each is stamped
// after a successful send, so re-runs never double-send.
//
// The selection predicate is a pure function (selectTenantsNeedingReminder) so
// the who-gets-reminded logic is unit-tested without touching Supabase.
import { needsReminder, REMINDER_LEAD_DAYS, trialDaysLeft } from "./trial";
import { sendEmail, type EmailMessage } from "./email";
import { SITE_URL } from "../lib/sitemap";

export interface ReminderTenant {
  id: string;
  name: string;
  trialEndsAt: string | null;
  trialRemindedAt: string | null;
}

/** Pure: which of these tenants should get a reminder right now. */
export function selectTenantsNeedingReminder(
  tenants: ReadonlyArray<ReminderTenant>,
  now: Date,
): ReminderTenant[] {
  return tenants.filter((t) =>
    needsReminder({ trialEndsAt: t.trialEndsAt, trialRemindedAt: t.trialRemindedAt }, now),
  );
}

/** Pure: the reminder email for a tenant with `daysLeft` remaining. */
export function trialReminderMessage(to: string, workspaceName: string, daysLeft: number): EmailMessage {
  const dayWord = daysLeft === 1 ? "day" : "days";
  const subject = `Your live bank sync trial ends in ${daysLeft} ${dayWord}`;
  const settingsUrl = `${SITE_URL}/workspace/settings`;
  const text =
    `Hi,\n\n${workspaceName}'s free trial of live bank sync ends in ${daysLeft} ${dayWord}. ` +
    `To keep your accounts updating themselves, add a card — it's NZD $15/mo, and you ` +
    `can cancel anytime. If you do nothing, your workspace simply stays on the free plan ` +
    `with manual accounts; none of your data goes anywhere.\n\n` +
    `Keep live sync on: ${settingsUrl}\n\n— YouInc`;
  const html =
    `<p>Hi,</p>` +
    `<p><strong>${workspaceName}</strong>'s free trial of live bank sync ends in ` +
    `<strong>${daysLeft} ${dayWord}</strong>. To keep your accounts updating themselves, ` +
    `add a card — it's <strong>NZD $15/mo</strong>, and you can cancel anytime.</p>` +
    `<p>If you do nothing, your workspace simply stays on the free plan with manual ` +
    `accounts; none of your data goes anywhere.</p>` +
    `<p><a href="${settingsUrl}">Keep live sync on →</a></p>` +
    `<p>— YouInc</p>`;
  return { to, subject, html, text };
}

export interface ReminderRunSummary {
  considered: number;
  sent: number;
}

/**
 * Find Free tenants whose trial is inside the reminder lead window and not yet
 * reminded, email each owner, and stamp trial_reminded_at on success.
 */
export async function sendTrialReminders(now: Date = new Date()): Promise<ReminderRunSummary> {
  const { getSupabaseAdminClient } = await import("./supabaseAdmin");
  const admin = getSupabaseAdminClient();

  const { data, error } = await admin
    .from("tenants")
    .select("id, name, trial_ends_at, trial_reminded_at")
    .eq("tier", "free")
    .not("trial_ends_at", "is", null)
    .is("trial_reminded_at", null);
  if (error) throw new Error(`trial reminder query failed: ${error.message}`);

  const rows = (data ?? []) as Array<{
    id: string;
    name: string;
    trial_ends_at: string | null;
    trial_reminded_at: string | null;
  }>;
  const candidates: ReminderTenant[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    trialEndsAt: r.trial_ends_at,
    trialRemindedAt: r.trial_reminded_at,
  }));
  const due = selectTenantsNeedingReminder(candidates, now);

  let sent = 0;
  for (const tenant of due) {
    const email = await ownerEmail(admin, tenant.id);
    if (!email) continue;
    const daysLeft = trialDaysLeft(tenant.trialEndsAt, now) ?? REMINDER_LEAD_DAYS;
    const result = await sendEmail(trialReminderMessage(email, tenant.name, daysLeft));
    if (!result.sent) continue;
    await admin
      .from("tenants")
      // Service-role client is schema-untyped, so update() infers `never` — cast
      // the payload, matching the established pattern in server/passkeys.ts.
      .update({ trial_reminded_at: now.toISOString() } as never)
      .eq("id", tenant.id);
    sent += 1;
  }

  return { considered: due.length, sent };
}

type AdminClient = Awaited<ReturnType<typeof import("./supabaseAdmin").getSupabaseAdminClient>>;

/** Resolve the active owner's email for a tenant via memberships → auth admin. */
async function ownerEmail(admin: AdminClient, tenantId: string): Promise<string | null> {
  const { data, error } = await admin
    .from("memberships")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("role", "owner")
    .eq("status", "active")
    .limit(1);
  if (error) return null;
  const userId = (data?.[0] as { user_id: string } | undefined)?.user_id;
  if (!userId) return null;
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
  if (userError) return null;
  return userData.user?.email ?? null;
}
