// Shared "resend the signup confirmation email" logic for /signin (unverified
// sign-in attempts) and /signup (the "check your email" screen), so both
// routes get identical resend + cooldown behavior from one place instead of
// two hand-rolled copies.
import { useCallback, useEffect, useRef, useState } from "react";
import { classifyAuthError } from "~/lib/authResend";
import { getSupabaseBrowserClient } from "~/lib/supabaseBrowser";

// Supabase's `resend` rate-limit error doesn't carry a machine-readable
// retry-after hint (see @supabase/auth-js's AuthApiError — it only exposes
// `code`/`status`/`message`), so we debounce with a sane fixed client-side
// cooldown instead of trying to parse one out of the response.
const RATE_LIMIT_COOLDOWN_SECONDS = 45;
const POST_SEND_COOLDOWN_SECONDS = 30;

export type ResendStatus = "idle" | "sending" | "sent" | "error";

export interface UseResendVerificationResult {
  status: ResendStatus;
  message: string | null;
  /** Seconds remaining before the resend button is usable again. */
  cooldownSeconds: number;
  /** True while `cooldownSeconds > 0` or a send is in flight. */
  disabled: boolean;
  resend: (email: string) => Promise<void>;
}

export function useResendVerification(): UseResendVerificationResult {
  const [status, setStatus] = useState<ResendStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startCooldown = useCallback((seconds: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setCooldownSeconds(seconds);
    intervalRef.current = setInterval(() => {
      setCooldownSeconds((current) => {
        if (current <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  }, []);

  const resend = useCallback(
    async (email: string) => {
      if (status === "sending" || cooldownSeconds > 0) return;

      setStatus("sending");
      setMessage(null);
      try {
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase.auth.resend({ type: "signup", email });
        if (error) {
          const kind = classifyAuthError(error);
          if (kind === "rate_limited") {
            setMessage("You've requested that too many times. Try again shortly.");
            startCooldown(RATE_LIMIT_COOLDOWN_SECONDS);
          } else {
            setMessage(error.message || "Couldn't resend the email. Please try again.");
          }
          setStatus("error");
          return;
        }
        setStatus("sent");
        setMessage("Verification email sent. Check your inbox.");
        startCooldown(POST_SEND_COOLDOWN_SECONDS);
      } catch {
        setStatus("error");
        setMessage("Couldn't resend the email. Please try again.");
      }
    },
    [status, cooldownSeconds, startCooldown],
  );

  return {
    status,
    message,
    cooldownSeconds,
    disabled: status === "sending" || cooldownSeconds > 0,
    resend,
  };
}
