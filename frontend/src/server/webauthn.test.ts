import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the TanStack request context so resolveRelyingParty can derive an
// rpID/origin without a live request, and mock @simplewebauthn/server so the
// verification helpers can be exercised in isolation from real crypto.
const getRequestMock = vi.fn();
vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => getRequestMock(),
}));

const verifyRegistrationResponseMock = vi.fn();
const verifyAuthenticationResponseMock = vi.fn();
vi.mock("@simplewebauthn/server", () => ({
  verifyRegistrationResponse: (opts: unknown) =>
    verifyRegistrationResponseMock(opts),
  verifyAuthenticationResponse: (opts: unknown) =>
    verifyAuthenticationResponseMock(opts),
  generateRegistrationOptions: vi.fn(),
  generateAuthenticationOptions: vi.fn(),
}));

import {
  resolveRelyingParty,
  verifyRegistration,
  verifyAuthentication,
  bytesToBase64,
  base64ToBytes,
} from "./webauthn";

function fakeRequest(url: string, headers: Record<string, string> = {}) {
  return {
    url,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  };
}

beforeEach(() => {
  delete process.env.PASSKEY_RP_ID;
  delete process.env.PASSKEY_RP_ORIGIN;
  getRequestMock.mockReset();
  verifyRegistrationResponseMock.mockReset();
  verifyAuthenticationResponseMock.mockReset();
});

afterEach(() => {
  delete process.env.PASSKEY_RP_ID;
  delete process.env.PASSKEY_RP_ORIGIN;
});

describe("bytesToBase64 / base64ToBytes", () => {
  it("round-trips arbitrary bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 255, 128, 64]);
    const round = base64ToBytes(bytesToBase64(bytes));
    expect(Array.from(round)).toEqual(Array.from(bytes));
  });
});

describe("resolveRelyingParty", () => {
  it("prefers explicit PASSKEY_RP_ID / PASSKEY_RP_ORIGIN overrides", () => {
    process.env.PASSKEY_RP_ID = "example.com";
    process.env.PASSKEY_RP_ORIGIN = "https://example.com";
    expect(resolveRelyingParty()).toEqual({
      rpID: "example.com",
      origin: "https://example.com",
    });
    expect(getRequestMock).not.toHaveBeenCalled();
  });

  it("derives rpID (hostname) and origin from the request", () => {
    getRequestMock.mockReturnValue(
      fakeRequest("http://localhost:3000/signin", { host: "localhost:3000" }),
    );
    expect(resolveRelyingParty()).toEqual({
      rpID: "localhost",
      origin: "http://localhost:3000",
    });
  });

  it("honors x-forwarded-host / x-forwarded-proto behind a proxy", () => {
    getRequestMock.mockReturnValue(
      fakeRequest("http://internal:3000/signin", {
        "x-forwarded-host": "app.youinc.nz",
        "x-forwarded-proto": "https",
      }),
    );
    expect(resolveRelyingParty()).toEqual({
      rpID: "app.youinc.nz",
      origin: "https://app.youinc.nz",
    });
  });
});

describe("verifyRegistration", () => {
  beforeEach(() => {
    process.env.PASSKEY_RP_ID = "localhost";
    process.env.PASSKEY_RP_ORIGIN = "http://localhost:3000";
  });

  it("maps the verified credential and passes the expected challenge", async () => {
    verifyRegistrationResponseMock.mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: {
          id: "cred-1",
          publicKey: new Uint8Array([9, 8, 7]),
          counter: 3,
          transports: ["internal"],
        },
      },
    });

    const result = await verifyRegistration({
      response: { id: "cred-1" } as never,
      expectedChallenge: "chal-abc",
    });

    expect(result).toEqual({
      credentialId: "cred-1",
      publicKey: new Uint8Array([9, 8, 7]),
      counter: 3,
      transports: ["internal"],
    });
    const opts = verifyRegistrationResponseMock.mock.calls[0][0];
    expect(opts.expectedChallenge).toBe("chal-abc");
    expect(opts.expectedRPID).toBe("localhost");
    expect(opts.expectedOrigin).toBe("http://localhost:3000");
  });

  it("throws when verification fails", async () => {
    verifyRegistrationResponseMock.mockResolvedValue({ verified: false });
    await expect(
      verifyRegistration({
        response: {} as never,
        expectedChallenge: "x",
      }),
    ).rejects.toThrow(/could not be verified/i);
  });
});

describe("verifyAuthentication", () => {
  beforeEach(() => {
    process.env.PASSKEY_RP_ID = "localhost";
    process.env.PASSKEY_RP_ORIGIN = "http://localhost:3000";
  });

  it("returns the new counter and forwards the stored credential", async () => {
    verifyAuthenticationResponseMock.mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 42 },
    });

    const result = await verifyAuthentication({
      response: { id: "cred-1" } as never,
      expectedChallenge: "chal-xyz",
      credential: {
        id: "cred-1",
        publicKey: new Uint8Array([1, 2, 3]),
        counter: 41,
      },
    });

    expect(result).toEqual({ newCounter: 42 });
    const opts = verifyAuthenticationResponseMock.mock.calls[0][0];
    expect(opts.expectedChallenge).toBe("chal-xyz");
    expect(opts.credential.counter).toBe(41);
  });

  it("throws when the signature can't be verified", async () => {
    verifyAuthenticationResponseMock.mockResolvedValue({ verified: false });
    await expect(
      verifyAuthentication({
        response: {} as never,
        expectedChallenge: "x",
        credential: { id: "c", publicKey: new Uint8Array([1]), counter: 0 },
      }),
    ).rejects.toThrow(/could not be verified/i);
  });
});
