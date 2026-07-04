// Shared server-fn error type.
//
// TanStack Start's server-fn client (@tanstack/start-client-core) treats a
// THROWN `Response` as a raw passthrough: the server handler tags it with the
// `x-tss-raw` header and the client fetcher returns that Response object
// verbatim as the call's RESOLVED value instead of rejecting the promise
// (see server-functions-handler.js `unwrapped instanceof Response` branch and
// serverFnFetcher.js's `x-tss-raw` check). Any `try { setX(await fn()) } catch
// {...}` call site never sees its catch block run — state silently gets set to
// a Response instance instead of the expected data, and the error never
// surfaces in the UI.
//
// Throwing a plain Error (not a Response) does not hit that raw-passthrough
// branch: it is serialized (seroval) into the RPC result's `error` field and
// re-thrown client-side, so it lands in the caller's `catch` as an `Error`
// with `.message` intact — exactly what every UI catch site here already
// expects (`err instanceof Error ? err.message : ...`).
//
// Use `ServerFnError` wherever a server function used to `throw new
// Response(message, { status })`. The `status` is preserved as a plain own
// property for server-side logging/introspection; it does not survive as a
// distinct client-side error subtype (seroval reconstructs a generic `Error`
// with `name` restored to `"ServerFnError"`), so client code should not
// branch on `status` — only on `.message`.
export class ServerFnError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ServerFnError";
    this.status = status;
  }
}

/** Throw a catchable server-fn error carrying an HTTP-ish status code. */
export function throwServerError(message: string, status: number): never {
  throw new ServerFnError(message, status);
}
