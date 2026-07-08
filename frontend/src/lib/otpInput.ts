/** Normalize a signup-confirmation code as the user types or pastes it: strip
 * everything but digits (spaces, dashes) and cap at `maxLength`. */
export function sanitizeOtpDigits(raw: string, maxLength = 6): string {
  return raw.replace(/\D/g, "").slice(0, maxLength);
}
