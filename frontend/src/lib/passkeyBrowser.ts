// Thin browser-side wrappers around @simplewebauthn/browser for the passkey
// ceremonies. Kept in one place so the routes don't each import the library
// directly, and so "does this browser support passkeys / conditional UI" checks
// live in a single spot.
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
} from "@simplewebauthn/browser";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/browser";

export { browserSupportsWebAuthn, browserSupportsWebAuthnAutofill };

/** Run the registration ceremony. Rejects if the user cancels or no
 * authenticator is available. */
export function runRegistration(
  optionsJSON: PublicKeyCredentialCreationOptionsJSON,
): Promise<RegistrationResponseJSON> {
  return startRegistration({ optionsJSON });
}

/** Run an explicit (button-triggered) authentication ceremony. */
export function runAuthentication(
  optionsJSON: PublicKeyCredentialRequestOptionsJSON,
): Promise<AuthenticationResponseJSON> {
  return startAuthentication({ optionsJSON });
}

/** Run a passive conditional-mediation authentication (autofill popover). The
 * promise resolves only if the user picks a passkey; callers should treat
 * cancellation/abort as a no-op. */
export function runConditionalAuthentication(
  optionsJSON: PublicKeyCredentialRequestOptionsJSON,
): Promise<AuthenticationResponseJSON> {
  return startAuthentication({ optionsJSON, useBrowserAutofill: true });
}
