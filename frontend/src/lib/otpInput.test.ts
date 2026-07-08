import { describe, expect, it } from "vitest";
import { sanitizeOtpDigits } from "./otpInput";

describe("sanitizeOtpDigits", () => {
  it("strips non-digit characters", () => {
    // Arrange
    const raw = "123-456";

    // Act
    const result = sanitizeOtpDigits(raw);

    // Assert
    expect(result).toBe("123456");
  });

  it("strips whitespace from a pasted code", () => {
    // Arrange
    const raw = "123 456";

    // Act
    const result = sanitizeOtpDigits(raw);

    // Assert
    expect(result).toBe("123456");
  });

  it("caps the result at 6 digits by default", () => {
    // Arrange
    const raw = "1234567890";

    // Act
    const result = sanitizeOtpDigits(raw);

    // Assert
    expect(result).toBe("123456");
  });

  it("returns an empty string when given no digits", () => {
    // Arrange
    const raw = "abc-def";

    // Act
    const result = sanitizeOtpDigits(raw);

    // Assert
    expect(result).toBe("");
  });

  it("respects a custom max length", () => {
    // Arrange
    const raw = "12345678";

    // Act
    const result = sanitizeOtpDigits(raw, 4);

    // Assert
    expect(result).toBe("1234");
  });
});
