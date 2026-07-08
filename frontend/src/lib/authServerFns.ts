// Isomorphic server-function boundary for the multi-step auth flows. Every
// handler lazily imports the server-only implementation so the native/crypto/
// Supabase-admin code never lands in the client bundle (same pattern as the
// ledger server fns). Shared here rather than colocated because the six step
// routes reuse the same handful of calls.
import { createServerFn } from "@tanstack/react-start";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/browser";
import type { AuthFlow } from "~/server/authFlows";

// --- Session / flow lifecycle ------------------------------------------------

export const checkAuthed = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getServerUser } = await import("~/server/supabaseServer");
    return { authenticated: Boolean(await getServerUser()) };
  },
);

export const loadFlow = createServerFn({ method: "GET" })
  .validator((token: string) => token)
  .handler(async ({ data: token }): Promise<AuthFlow | null> => {
    const { getAuthFlow } = await import("~/server/authFlows");
    return getAuthFlow(token);
  });

export const startSignupFlow = createServerFn({ method: "POST" })
  .validator((email: string) => email)
  .handler(async ({ data: email }): Promise<{ token: string }> => {
    const { startAuthFlow } = await import("~/server/authFlows");
    return { token: await startAuthFlow("signup", email) };
  });

export const advanceFlow = createServerFn({ method: "POST" })
  .validator(
    (data: {
      token: string;
      nextStep?: string;
      firstName?: string | null;
      lastName?: string | null;
    }) => data,
  )
  .handler(async ({ data }): Promise<AuthFlow> => {
    const { updateAuthFlow } = await import("~/server/authFlows");
    return updateAuthFlow(data.token, {
      nextStep: data.nextStep,
      firstName: data.firstName,
      lastName: data.lastName,
    });
  });

// --- Signup: passkey registration -------------------------------------------

export const beginRegistration = createServerFn({ method: "POST" })
  .validator((token: string) => token)
  .handler(
    async ({
      data: token,
    }): Promise<{
      options: PublicKeyCredentialCreationOptionsJSON;
      hasSession: boolean;
    }> => {
      const { beginPasskeyRegistration } = await import("~/server/passkeys");
      return beginPasskeyRegistration(token);
    },
  );

export const finishRegistration = createServerFn({ method: "POST" })
  .validator(
    (data: { token: string; response: RegistrationResponseJSON }) => data,
  )
  .handler(async ({ data }): Promise<{ hasSession: boolean }> => {
    const { finishPasskeyRegistration } = await import("~/server/passkeys");
    return finishPasskeyRegistration(data.token, data.response);
  });

export const signupSetPassword = createServerFn({ method: "POST" })
  .validator((data: { token: string; password: string }) => data)
  .handler(async ({ data }): Promise<{ hasSession: boolean }> => {
    const { setSignupPassword } = await import("~/server/passkeys");
    return setSignupPassword(data.token, data.password);
  });

export const signupWithPassword = createServerFn({ method: "POST" })
  .validator((data: { token: string; password: string }) => data)
  .handler(async ({ data }): Promise<{ hasSession: boolean }> => {
    const { passwordSignup } = await import("~/server/passkeys");
    return passwordSignup(data.token, data.password);
  });

export const confirmSignupCode = createServerFn({ method: "POST" })
  .validator((data: { email: string; token: string }) => data)
  .handler(async ({ data }): Promise<void> => {
    const { confirmSignupCode: confirmCode } = await import(
      "~/server/passkeys"
    );
    return confirmCode(data.email, data.token);
  });

// --- Signin: email → passkey / password -------------------------------------

export const initSigninFlow = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    token: string;
    options: PublicKeyCredentialRequestOptionsJSON;
  }> => {
    const { startAuthFlow } = await import("~/server/authFlows");
    const { beginPasskeyAuthentication } = await import("~/server/passkeys");
    const token = await startAuthFlow("signin", null);
    const options = await beginPasskeyAuthentication(token);
    return { token, options };
  },
);

export const checkEmailForPasskey = createServerFn({ method: "POST" })
  .validator((data: { token: string; email: string }) => data)
  .handler(async ({ data }): Promise<AuthFlow> => {
    const { passkeyExistsForEmail, updateAuthFlow } = await import(
      "~/server/authFlows"
    );
    const hasPasskey = await passkeyExistsForEmail(data.email);
    return updateAuthFlow(data.token, {
      email: data.email,
      hasPasskey,
      nextStep: "password",
    });
  });

export const beginAuthentication = createServerFn({ method: "POST" })
  .validator((token: string) => token)
  .handler(
    async ({
      data: token,
    }): Promise<PublicKeyCredentialRequestOptionsJSON> => {
      const { beginPasskeyAuthentication } = await import("~/server/passkeys");
      return beginPasskeyAuthentication(token);
    },
  );

export const finishAuthentication = createServerFn({ method: "POST" })
  .validator(
    (data: { token: string; response: AuthenticationResponseJSON }) => data,
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { finishPasskeyAuthentication } = await import("~/server/passkeys");
    return finishPasskeyAuthentication(data.token, data.response);
  });
