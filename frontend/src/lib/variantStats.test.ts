import { describe, expect, it } from "vitest";
import {
  MIN_SAMPLE_SIZE_PER_VARIANT,
  pickLeader,
  twoProportionZTest,
  wilsonScoreInterval,
} from "./variantStats";

describe("wilsonScoreInterval", () => {
  it("contains the point estimate for a mid-sized sample", () => {
    // Arrange
    const upCount = 60;
    const total = 100;

    // Act
    const interval = wilsonScoreInterval(upCount, total);

    // Assert
    const pointEstimate = upCount / total;
    expect(interval.lower).toBeLessThanOrEqual(pointEstimate);
    expect(interval.upper).toBeGreaterThanOrEqual(pointEstimate);
  });

  it("widens as the sample size shrinks, holding the proportion fixed", () => {
    // Arrange
    const largeSample = wilsonScoreInterval(60, 100);
    const smallSample = wilsonScoreInterval(6, 10);

    // Act
    const largeWidth = largeSample.upper - largeSample.lower;
    const smallWidth = smallSample.upper - smallSample.lower;

    // Assert
    expect(smallWidth).toBeGreaterThan(largeWidth);
  });

  it("returns a zero-width interval at zero total instead of dividing by zero", () => {
    // Arrange & Act
    const interval = wilsonScoreInterval(0, 0);

    // Assert
    expect(interval).toEqual({ lower: 0, upper: 0 });
  });

  it("stays within [0, 1] bounds for an extreme proportion", () => {
    // Arrange & Act
    const interval = wilsonScoreInterval(1, 1);

    // Assert
    expect(interval.lower).toBeGreaterThanOrEqual(0);
    expect(interval.upper).toBeLessThanOrEqual(1);
  });
});

describe("twoProportionZTest", () => {
  it("returns a p-value near 1 for identical proportions", () => {
    // Arrange
    const a = { upCount: 50, total: 100 };
    const b = { upCount: 50, total: 100 };

    // Act
    const { pValue } = twoProportionZTest(a, b);

    // Assert
    expect(pValue).toBeGreaterThan(0.9);
  });

  it("returns a p-value near 0 for a large, clear difference", () => {
    // Arrange
    const a = { upCount: 800, total: 1000 };
    const b = { upCount: 500, total: 1000 };

    // Act
    const { pValue } = twoProportionZTest(a, b);

    // Assert
    expect(pValue).toBeLessThan(0.001);
  });

  it("returns a neutral result when a sample has zero observations", () => {
    // Arrange
    const a = { upCount: 0, total: 0 };
    const b = { upCount: 10, total: 20 };

    // Act
    const result = twoProportionZTest(a, b);

    // Assert
    expect(result).toEqual({ z: 0, pValue: 1 });
  });

  it("is symmetric: swapping a and b flips the sign of z but not the p-value", () => {
    // Arrange
    const a = { upCount: 80, total: 100 };
    const b = { upCount: 50, total: 100 };

    // Act
    const forward = twoProportionZTest(a, b);
    const backward = twoProportionZTest(b, a);

    // Assert
    expect(forward.z).toBeCloseTo(-backward.z, 10);
    expect(forward.pValue).toBeCloseTo(backward.pValue, 10);
  });
});

describe("pickLeader", () => {
  it("flags no leader when both variants have zero votes", () => {
    // Arrange
    const aggregates = {
      A: { upCount: 0, total: 0 },
      B: { upCount: 0, total: 0 },
    };

    // Act
    const result = pickLeader(aggregates);

    // Assert
    expect(result).toEqual({
      leaderVariant: null,
      isSignificant: false,
      pValue: null,
    });
  });

  it("flags no leader when proportions are tied", () => {
    // Arrange
    const aggregates = {
      A: { upCount: 50, total: 100 },
      B: { upCount: 50, total: 100 },
    };

    // Act
    const result = pickLeader(aggregates);

    // Assert
    expect(result.leaderVariant).toBeNull();
    expect(result.isSignificant).toBe(false);
  });

  it("does not flag a leader when a variant is below MIN_SAMPLE_SIZE_PER_VARIANT, even if the split looks stark", () => {
    // Arrange: 9 vs 1 up out of 29 total each — a stark split that would read
    // as significant (p < 0.05) if the min-sample-size guard were removed.
    const belowMinSample = MIN_SAMPLE_SIZE_PER_VARIANT - 1;
    const aggregates = {
      A: { upCount: 9, total: belowMinSample },
      B: { upCount: 1, total: belowMinSample },
    };
    const { pValue: unguardedPValue } = twoProportionZTest(
      aggregates.A,
      aggregates.B,
    );

    // Act
    const result = pickLeader(aggregates);

    // Assert: sanity-check the premise (would look significant unguarded)...
    expect(unguardedPValue).toBeLessThan(0.05);
    // ...but the sample-size guard still blocks it.
    expect(result).toEqual({
      leaderVariant: null,
      isSignificant: false,
      pValue: null,
    });
  });

  it("flags the correct leader for a clear winner with large samples", () => {
    // Arrange
    const aggregates = {
      A: { upCount: 800, total: 1000 },
      B: { upCount: 500, total: 1000 },
    };

    // Act
    const result = pickLeader(aggregates);

    // Assert
    expect(result.leaderVariant).toBe("A");
    expect(result.isSignificant).toBe(true);
    expect(result.pValue).not.toBeNull();
    expect(result.pValue as number).toBeLessThan(0.05);
  });

  it("returns no leader when the input does not contain exactly two variants", () => {
    // Arrange
    const oneVariant = { A: { upCount: 40, total: 100 } };
    const threeVariants = {
      A: { upCount: 40, total: 100 },
      B: { upCount: 40, total: 100 },
      C: { upCount: 40, total: 100 },
    };

    // Act
    const oneResult = pickLeader(oneVariant);
    const threeResult = pickLeader(threeVariants);

    // Assert
    expect(oneResult).toEqual({
      leaderVariant: null,
      isSignificant: false,
      pValue: null,
    });
    expect(threeResult).toEqual({
      leaderVariant: null,
      isSignificant: false,
      pValue: null,
    });
  });
});
