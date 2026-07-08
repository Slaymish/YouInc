import { beforeEach, describe, expect, it, vi } from "vitest";

// Same mocking convention as feedbackStats.test.ts: stub getSupabaseServerClient
// down to the one method under test so this stays a plain-node vitest run.
const verifyOtpMock = vi.fn();

vi.mock("./supabaseServer", () => ({
  getSupabaseServerClient: () => ({ auth: { verifyOtp: verifyOtpMock } }),
}));

import { confirmSignupCode } from "./passkeys";
import { ServerFnError } from "./serverError";

describe("confirmSignupCode", () => {
  beforeEach(() => {
    verifyOtpMock.mockReset();
  });

  it("calls verifyOtp with the email, code, and signup type", async () => {
    // Arrange
    verifyOtpMock.mockResolvedValue({ error: null });

    // Act
    await confirmSignupCode("person@example.com", "123456");

    // Assert
    expect(verifyOtpMock).toHaveBeenCalledWith({
      email: "person@example.com",
      token: "123456",
      type: "signup",
    });
  });

  it("throws a friendly ServerFnError when the code is invalid or expired", async () => {
    // Arrange
    verifyOtpMock.mockResolvedValue({ error: { message: "Token has expired" } });

    // Act & Assert
    await expect(
      confirmSignupCode("person@example.com", "000000"),
    ).rejects.toMatchObject(
      new ServerFnError(
        "That code is invalid or has expired — check the digits, or resend the email.",
        400,
      ),
    );
  });
});
