// Pure trial-timing logic for the 14-day live-sync trial. Dependency-free (no
// Supabase, no `~/`) so vitest (node env) tests it directly, and so the sync
// gate, the reminder job, and the UI all share one source of truth for "is the
// trial still live / how long left / does it need a reminder". `TenantTier` is a
// type-only import (erased at compile) so this stays runtime-pure.
import type { TenantTier } from "./accounts";

export const TRIAL_DAYS = 14;
export const REMINDER_LEAD_DAYS = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

/** True iff a trial has been started and its end is still in the future. */
export function isTrialActive(trialEndsAt: string | null, now: Date): boolean {
  if (!trialEndsAt) return false;
  return new Date(trialEndsAt).getTime() > now.getTime();
}

/**
 * The single sync-gate predicate: paid tiers always may connect; a Free tenant
 * may connect only while a trial is active.
 */
export function canConnectLive(
  tenant: { tier: TenantTier; trialEndsAt: string | null },
  now: Date,
): boolean {
  return tenant.tier !== "free" || isTrialActive(tenant.trialEndsAt, now);
}

/** Whole days remaining (ceil), 0 if past, null if no trial started. */
export function trialDaysLeft(trialEndsAt: string | null, now: Date): number | null {
  if (!trialEndsAt) return null;
  const ms = new Date(trialEndsAt).getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / DAY_MS);
}

/** True iff the trial is active, not yet reminded, and within the lead window. */
export function needsReminder(
  tenant: { trialEndsAt: string | null; trialRemindedAt: string | null },
  now: Date,
): boolean {
  if (!isTrialActive(tenant.trialEndsAt, now)) return false;
  if (tenant.trialRemindedAt) return false;
  const left = trialDaysLeft(tenant.trialEndsAt, now);
  return left !== null && left <= REMINDER_LEAD_DAYS;
}
