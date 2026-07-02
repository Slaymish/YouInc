// @simplewebauthn/server pulls in @peculiar/x509 + tsyringe, which run
// Reflect.getMetadata decorators at import time. This polyfill must be loaded
// (and evaluated) before that happens. The exported flag is consumed by callers
// so the bundler can't tree-shake this side-effect-only import away.
import "reflect-metadata";

export const REFLECT_METADATA_LOADED =
  typeof Reflect !== "undefined" &&
  typeof (Reflect as unknown as { getMetadata?: unknown }).getMetadata === "function";
