// Pure statistics helpers for the variant-voting admin view (see todo.md
// "IN PROGRESS: Variant voting — make it useful"). No Supabase or native
// imports here — everything is testable in isolation (variantStats.test.ts).
// Consumed by server/feedbackStats.ts, which maps the feedback_variant_stats
// RPC's snake_case rows into VariantAggregate before calling pickLeader.

export interface VariantAggregate {
  variant: string;
  source: string;
  path: string;
  upCount: number;
  downCount: number;
  total: number;
  upRate: number;
}

/** Below this per-variant sample size, a difference is never flagged significant. */
export const MIN_SAMPLE_SIZE_PER_VARIANT = 30;

const DEFAULT_CONFIDENCE_Z = 1.96; // ~95% two-tailed normal critical value
const SIGNIFICANCE_P_THRESHOLD = 0.05;

export interface ScoreInterval {
  lower: number;
  upper: number;
}

/**
 * Wilson score interval for a binomial proportion (upCount successes out of
 * total trials). More reliable than the naive normal approximation at small
 * sample sizes or proportions near 0/1.
 */
export function wilsonScoreInterval(
  upCount: number,
  total: number,
  confidence: number = DEFAULT_CONFIDENCE_Z,
): ScoreInterval {
  if (total <= 0) {
    return { lower: 0, upper: 0 };
  }

  const z = confidence;
  const z2 = z * z;
  const p = upCount / total;
  const denominator = 1 + z2 / total;
  const center = p + z2 / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total));

  return {
    lower: Math.max(0, (center - margin) / denominator),
    upper: Math.min(1, (center + margin) / denominator),
  };
}

/**
 * Abramowitz-Stegun rational approximation of the error function (max
 * absolute error ~1.5e-7). No external stats library is a dependency here.
 */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1 / (1 + p * absX);
  const y =
    1 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return sign * y;
}

/** Standard normal CDF, built on the erf approximation above. */
function standardNormalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

export interface ProportionSample {
  upCount: number;
  total: number;
}

export interface ZTestResult {
  z: number;
  pValue: number;
}

/**
 * Two-proportion z-test using a pooled proportion for the standard error.
 * Returns a neutral { z: 0, pValue: 1 } when either sample has no
 * observations or the pooled proportion makes the standard error zero
 * (comparison is undefined in both cases).
 */
export function twoProportionZTest(
  a: ProportionSample,
  b: ProportionSample,
): ZTestResult {
  if (a.total <= 0 || b.total <= 0) {
    return { z: 0, pValue: 1 };
  }

  const p1 = a.upCount / a.total;
  const p2 = b.upCount / b.total;
  const pooled = (a.upCount + b.upCount) / (a.total + b.total);
  const standardError = Math.sqrt(
    pooled * (1 - pooled) * (1 / a.total + 1 / b.total),
  );

  if (standardError === 0) {
    return { z: 0, pValue: 1 };
  }

  const z = (p1 - p2) / standardError;
  const pValue = 2 * (1 - standardNormalCdf(Math.abs(z)));

  return { z, pValue };
}

export interface LeaderResult {
  leaderVariant: string | null;
  isSignificant: boolean;
  pValue: number | null;
}

/**
 * Given pooled per-variant totals (exactly two variants expected — this app
 * only ever assigns "A"/"B", see FeedbackWidget.tsx), decides whether one
 * variant is a statistically significant leader. Requires BOTH variants to
 * have total >= MIN_SAMPLE_SIZE_PER_VARIANT AND p < 0.05 from the
 * two-proportion z-test; otherwise flags nothing. Never auto-promotes a
 * winner (see todo.md design decision 5) — this is a flag only.
 */
export function pickLeader(
  aggregatesByVariant: Record<string, ProportionSample>,
): LeaderResult {
  const variants = Object.keys(aggregatesByVariant);
  if (variants.length !== 2) {
    return { leaderVariant: null, isSignificant: false, pValue: null };
  }

  const [variantA, variantB] = variants;
  const a = aggregatesByVariant[variantA];
  const b = aggregatesByVariant[variantB];

  if (
    a.total < MIN_SAMPLE_SIZE_PER_VARIANT ||
    b.total < MIN_SAMPLE_SIZE_PER_VARIANT
  ) {
    return { leaderVariant: null, isSignificant: false, pValue: null };
  }

  const { pValue } = twoProportionZTest(a, b);
  if (pValue >= SIGNIFICANCE_P_THRESHOLD) {
    return { leaderVariant: null, isSignificant: false, pValue };
  }

  const rateA = a.upCount / a.total;
  const rateB = b.upCount / b.total;
  const leaderVariant = rateA >= rateB ? variantA : variantB;

  return { leaderVariant, isSignificant: true, pValue };
}
