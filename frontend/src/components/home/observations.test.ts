import { describe, expect, it } from "vitest";
import { committedSpend, observations, risingStreaks } from "./observations";
import type { CategoryMonthPoint, RecurringPayment } from "~/server/analytics";

function month(account: string, month: string, dollars: number): CategoryMonthPoint {
  return { account, month, amountCents: dollars * 100 };
}

describe("risingStreaks", () => {
  it("spots three months of increases in one category", () => {
    // Arrange
    const rows = [
      month("Expenses:Power", "2026-06", 89),
      month("Expenses:Power", "2026-07", 104),
      month("Expenses:Power", "2026-08", 121),
    ];

    // Act
    const [observation] = risingStreaks(rows);

    // Assert
    expect(observation.text).toBe(
      "Power has gone up 3 months running — $89, $104, $121.",
    );
    expect(observation.tone).toBe("watch");
  });

  it("says nothing when the trend breaks", () => {
    // Arrange
    const rows = [
      month("Expenses:Power", "2026-06", 89),
      month("Expenses:Power", "2026-07", 130),
      month("Expenses:Power", "2026-08", 121),
    ];

    // Act + Assert
    expect(risingStreaks(rows)).toEqual([]);
  });

  it("needs enough months before it says anything", () => {
    // Arrange
    const rows = [month("Expenses:Power", "2026-08", 121)];

    // Act + Assert
    expect(risingStreaks(rows)).toEqual([]);
  });
});

describe("committedSpend", () => {
  const payment = (monthlyDollars: number): RecurringPayment => ({
    description: "SUBSCRIPTION",
    account: "Expenses:Software",
    amountCents: monthlyDollars * 100,
    occurrences: 4,
    cadenceDays: 30,
    cadence: "monthly",
    monthlyEquivalentCents: monthlyDollars * 100,
    firstDate: "2026-05-01",
    lastDate: "2026-08-01",
  });

  it("totals the regular payments once there are a few", () => {
    // Act
    const [observation] = committedSpend([payment(10), payment(15), payment(5)]);

    // Assert
    expect(observation.text).toContain("$30 a month");
  });

  it("stays quiet with one or two", () => {
    // Act + Assert
    expect(committedSpend([payment(10)])).toEqual([]);
  });
});

describe("observations", () => {
  it("leads with good news and caps the list", () => {
    // Arrange — four months of history so the z-score has something to work
    // with, with the latest month well below normal.
    const rows = [
      month("Expenses:Food", "2026-05", 400),
      month("Expenses:Food", "2026-06", 400),
      month("Expenses:Food", "2026-07", 410),
      month("Expenses:Food", "2026-08", 60),
      month("Expenses:Power", "2026-06", 89),
      month("Expenses:Power", "2026-07", 104),
      month("Expenses:Power", "2026-08", 121),
    ];

    // Act
    const out = observations({ categoryMonthly: rows, recurringPayments: [], limit: 3 });

    // Assert
    expect(out.length).toBeLessThanOrEqual(3);
    expect(out[0].tone).toBe("good");
    expect(out[0].text).toContain("less on Food");
  });

  it("reports one thing per category", () => {
    // Arrange
    const rows = [
      month("Expenses:Power", "2026-05", 60),
      month("Expenses:Power", "2026-06", 89),
      month("Expenses:Power", "2026-07", 104),
      month("Expenses:Power", "2026-08", 400),
    ];

    // Act
    const out = observations({ categoryMonthly: rows, recurringPayments: [] });

    // Assert
    const subjects = out.map((o) => o.id.split(":")[1]);
    expect(new Set(subjects).size).toBe(subjects.length);
  });
});
