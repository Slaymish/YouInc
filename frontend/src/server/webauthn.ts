// Server-only WebAuthn (passkey) helpers, built from scratch on
// @simplewebauthn/server v13 and scoped to Supabase multi-tenant accounts.
//
// The old single-owner passkey system (server/auth.ts) was already removed; this
// shares none of its code. @simplewebauthn/server is imported LAZILY inside each
// function so the native/crypto code never lands in the client bundle (server
// functions that call these lazily import this module in turn).
import { getRequest } from "@tanstack/react-start/server";
import type {
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { PRODUCT } from "~/components/marketing/config";

/** Lazily import @simplewebauthn/server so its native/crypto/x509 code never
 * lands in the client bundle.
 *
 * NOTE: @simplewebauthn/server → @peculiar/x509 → tsyringe run decorators AT
 * IMPORT TIME that read the global `Reflect.getMetadata`. That global is
 * installed by the reflect-metadata polyfill, which the prod build tree-shakes
 * out of the bundle — so it is preloaded at the Node process level instead
 * (see `docker/entrypoint.sh` / the `start` script's `--require`, and
 * `scripts/stage-reflect-polyfill.mjs`, run by `pnpm build`, which stages the
 * polyfill into `.output`).
 * Dev works without the preload because Vite serves x509 unbundled. */
function importWebAuthnServer() {
  return import("@simplewebauthn/server");
}

export interface RelyingParty {
  rpID: string;
  origin: string;
}

/**
 * Resolve the WebAuthn relying-party id + origin. Derived from the request by
 * default (works for localhost and any deployed domain), overridable via
 * PASSKEY_RP_ID / PASSKEY_RP_ORIGIN for deployments behind a proxy that
 * rewrites Host/Origin. Both overrides must be set together to take effect.
 */
export function resolveRelyingParty(): RelyingParty {
  const overrideId = process.env.PASSKEY_RP_ID?.trim();
  const overrideOrigin = process.env.PASSKEY_RP_ORIGIN?.trim();
  if (overrideId && overrideOrigin) {
    return { rpID: overrideId, origin: overrideOrigin };
  }

  const request = getRequest();
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const url = new URL(request.url);
  const host = forwardedHost ?? request.headers.get("host") ?? url.host;
  const proto = forwardedProto ?? url.protocol.replace(":", "");
  const origin = `${proto}://${host}`;
  // rpID is the effective domain (hostname only, no port).
  const rpID = new URL(origin).hostname;
  return { rpID, origin };
}

/** Registration options for a new passkey keyed to a Supabase user id. */
export async function buildRegistrationOptions(params: {
  userId: string;
  email: string;
  displayName?: string | null;
}) {
  const { generateRegistrationOptions } = await importWebAuthnServer();
  const { rpID } = resolveRelyingParty();
  return generateRegistrationOptions({
    rpName: PRODUCT.name,
    rpID,
    userName: params.email,
    userDisplayName: params.displayName ?? params.email,
    // Supabase user id (uuid) as the stable WebAuthn user handle.
    userID: new TextEncoder().encode(params.userId),
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });
}

/** Authentication options for a signin ceremony. Empty allowCredentials =
 * discoverable-credential / conditional-UI friendly. */
export async function buildAuthenticationOptions() {
  const { generateAuthenticationOptions } = await importWebAuthnServer();
  const { rpID } = resolveRelyingParty();
  return generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
  });
}

export interface VerifiedRegistration {
  credentialId: string;
  publicKey: Uint8Array;
  counter: number;
  transports?: AuthenticatorTransportFuture[];
}

/** Verify a registration response against the stored challenge. Throws on
 * failure; returns the credential to persist on success. */
export async function verifyRegistration(params: {
  response: RegistrationResponseJSON;
  expectedChallenge: string;
}): Promise<VerifiedRegistration> {
  const { verifyRegistrationResponse } = await importWebAuthnServer();
  const { rpID, origin } = resolveRelyingParty();
  const verification = await verifyRegistrationResponse({
    response: params.response,
    expectedChallenge: params.expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: false,
  });
  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Passkey registration could not be verified.");
  }
  const { credential } = verification.registrationInfo;
  return {
    credentialId: credential.id,
    publicKey: credential.publicKey,
    counter: credential.counter,
    transports: credential.transports,
  };
}

export interface VerifiedAuthentication {
  newCounter: number;
}

/** Verify an authentication (signin) assertion against a stored credential.
 * Throws on failure; returns the new counter to persist on success. */
export async function verifyAuthentication(params: {
  response: AuthenticationResponseJSON;
  expectedChallenge: string;
  credential: {
    id: string;
    publicKey: Uint8Array;
    counter: number;
    transports?: AuthenticatorTransportFuture[];
  };
}): Promise<VerifiedAuthentication> {
  const { verifyAuthenticationResponse } = await importWebAuthnServer();
  const { rpID, origin } = resolveRelyingParty();
  const verification = await verifyAuthenticationResponse({
    response: params.response,
    expectedChallenge: params.expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: params.credential.id,
      publicKey: params.credential.publicKey as Uint8Array<ArrayBuffer>,
      counter: params.credential.counter,
      transports: params.credential.transports,
    },
    requireUserVerification: false,
  });
  if (!verification.verified) {
    throw new Error("Passkey signature could not be verified.");
  }
  return { newCounter: verification.authenticationInfo.newCounter };
}

/** base64 (not url) encode bytes for transport to the DB layer. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** decode a base64 string (as returned by find_passkey_credential) to bytes. */
export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}
