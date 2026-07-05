import { describe, expect, it } from "vitest";
import { classifyAuthError } from "./authResend";

// Realistic shapes: @supabase/auth-js's AuthApiError sets `name`, `status`,
// and `code` (see node_modules/@supabase/auth-js/src/lib/errors.ts +
// error-codes.ts for the installed version). We construct plain objects
// here rather than importing AuthApiError so the test also documents the
// exact fields the classifier relies on.

describe("classifyAuthError", () => {
  it("classifies email_not_confirmed as unverified", () => {
    const error = {
      name: "AuthApiError",
      status: 400,
      code: "email_not_confirmed",
      message: "Email not confirmed",
    };
    expect(classifyAuthError(error)).toBe("unverified");
  });

  it("classifies invalid_credentials as invalid_credentials", () => {
    const error = {
      name: "AuthApiError",
      status: 400,
      code: "invalid_credentials",
      message: "Invalid login credentials",
    };
    expect(classifyAuthError(error)).toBe("invalid_credentials");
  });

  it("classifies over_email_send_rate_limit as rate_limited", () => {
    const error = {
      name: "AuthApiError",
      status: 429,
      code: "over_email_send_rate_limit",
      message: "Email rate limit exceeded",
    };
    expect(classifyAuthError(error)).toBe("rate_limited");
  });

  it("classifies over_request_rate_limit as rate_limited", () => {
    const error = {
      name: "AuthApiError",
      status: 429,
      code: "over_request_rate_limit",
      message: "Request rate limit reached",
    };
    expect(classifyAuthError(error)).toBe("rate_limited");
  });

  it("classifies an unrelated auth error as other", () => {
    const error = {
      name: "AuthApiError",
      status: 422,
      code: "weak_password",
      message: "Password is too weak",
    };
    expect(classifyAuthError(error)).toBe("other");
  });

  it("falls back to message matching when no code is present (older SDK shape)", () => {
    const error = { status: 400, message: "Email not confirmed" };
    expect(classifyAuthError(error)).toBe("unverified");
  });

  it("falls back to message matching for invalid credentials without a code", () => {
    const error = { status: 400, message: "Invalid login credentials" };
    expect(classifyAuthError(error)).toBe("invalid_credentials");
  });

  it("falls back to HTTP 429 status when no code is present", () => {
    const error = { status: 429, message: "Too many requests" };
    expect(classifyAuthError(error)).toBe("rate_limited");
  });

  it("returns other for a generic network error", () => {
    const error = new Error("Failed to fetch");
    expect(classifyAuthError(error)).toBe("other");
  });

  it("returns other for null, undefined, and non-object values", () => {
    expect(classifyAuthError(null)).toBe("other");
    expect(classifyAuthError(undefined)).toBe("other");
    expect(classifyAuthError("Email not confirmed")).toBe("other");
    expect(classifyAuthError(42)).toBe("other");
  });
});
