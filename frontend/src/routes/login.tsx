import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import "~/styles/login.css";

// --- Server functions (public: they gate themselves) -------------------------

const registrationOptionsFn = createServerFn({ method: "POST" })
  .validator((token: string) => token)
  .handler(async ({ data: token }) => {
    const { beginRegistration } = await import("~/server/auth");
    return beginRegistration(token);
  });

const verifyRegistrationFn = createServerFn({ method: "POST" })
  .validator((data: { response: RegistrationResponseJSON; token: string }) => data)
  .handler(async ({ data }) => {
    const { finishRegistration } = await import("~/server/auth");
    return finishRegistration(data.response, data.token);
  });

const authenticationOptionsFn = createServerFn({ method: "POST" }).handler(async () => {
  const { beginAuthentication } = await import("~/server/auth");
  return beginAuthentication();
});

const verifyAuthenticationFn = createServerFn({ method: "POST" })
  .validator((response: AuthenticationResponseJSON) => response)
  .handler(async ({ data: response }) => {
    const { finishAuthentication } = await import("~/server/auth");
    return finishAuthentication(response);
  });

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function LoginPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [enrollToken, setEnrollToken] = useState("");
  const [showEnroll, setShowEnroll] = useState(false);

  async function signIn() {
    setBusy(true);
    setStatus(null);
    try {
      const optionsJSON = await authenticationOptionsFn();
      const response = await startAuthentication({ optionsJSON });
      const { verified } = await verifyAuthenticationFn({ data: response });
      if (!verified) throw new Error("Passkey was not accepted.");
      await router.navigate({ to: "/workspace" });
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function enrol() {
    setBusy(true);
    setStatus(null);
    try {
      const optionsJSON = await registrationOptionsFn({ data: enrollToken });
      const response = await startRegistration({ optionsJSON });
      const { verified } = await verifyRegistrationFn({
        data: { response, token: enrollToken },
      });
      if (!verified) throw new Error("Registration failed.");
      await router.navigate({ to: "/workspace" });
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-heading">
        <p className="login-eyebrow">YouInc Ledger</p>
        <h1 id="login-heading">Unlock the ledger</h1>
        <p className="login-lede">Authenticate with your passkey to continue.</p>

        <button className="login-primary" onClick={signIn} disabled={busy}>
          {busy ? "Waiting…" : "Sign in with passkey"}
        </button>

        {status && <p className="login-status" role="alert">{status}</p>}

        <button
          className="login-link"
          type="button"
          onClick={() => setShowEnroll((v) => !v)}
        >
          {showEnroll ? "Cancel" : "Enrol a new passkey"}
        </button>

        {showEnroll && (
          <form
            className="login-enrol"
            onSubmit={(e) => {
              e.preventDefault();
              void enrol();
            }}
          >
            <label htmlFor="enroll-token">Enrolment token</label>
            <input
              id="enroll-token"
              type="password"
              autoComplete="off"
              value={enrollToken}
              onChange={(e) => setEnrollToken(e.target.value)}
              placeholder="YOUINC_ENROLLMENT_TOKEN"
            />
            <button className="login-primary" type="submit" disabled={busy || !enrollToken}>
              Create passkey
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
