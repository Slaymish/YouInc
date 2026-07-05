// Pure, dependency-free logic for the multi-step auth flow: step ordering,
// transition validation, and email normalization. Mirrors the server-side rules
// enforced by the auth_flows RPCs (migration 20260705160000) so the client can
// validate before a round-trip and so the rules are unit-testable in isolation
// (vitest, no Supabase client). Keep this in sync with auth_flow_step_rank().

export type AuthFlowKind = "signup" | "signin";

export const SIGNUP_STEPS = ["email", "name", "credential", "password"] as const;
export const SIGNIN_STEPS = ["email", "password"] as const;

export type SignupStep = (typeof SIGNUP_STEPS)[number];
export type SigninStep = (typeof SIGNIN_STEPS)[number];
export type AuthFlowStep = SignupStep | SigninStep;

/** 0-based rank of a step within its kind, or null if the step is invalid. */
export function stepRank(kind: AuthFlowKind, step: string): number | null {
  const steps: readonly string[] =
    kind === "signup" ? SIGNUP_STEPS : SIGNIN_STEPS;
  const index = steps.indexOf(step);
  return index === -1 ? null : index;
}

/** The first step ("email") for a flow of the given kind. */
export function firstStep(_kind: AuthFlowKind): "email" {
  return "email";
}

/**
 * Whether a flow may move from `from` to `to`: the target must be a valid step
 * for the kind and may advance at most one rank (staying or going back is fine),
 * never jumping ahead. Matches update_auth_flow's server-side check.
 */
export function canTransition(
  kind: AuthFlowKind,
  from: string,
  to: string,
): boolean {
  const fromRank = stepRank(kind, from);
  const toRank = stepRank(kind, to);
  if (fromRank === null || toRank === null) return false;
  return toRank <= fromRank + 1;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** True if the string looks like a valid email address. */
export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/** Trim + lowercase an email, returning null for blank input. */
export function normalizeEmail(email: string): string | null {
  const clean = email.trim().toLowerCase();
  return clean.length > 0 ? clean : null;
}
