import { afterEach, describe, expect, it, vi } from "vitest";

// Fresh module state per test: the cache is module-scoped by design.
async function loadCache() {
  vi.resetModules();
  return import("./authCache");
}

function withBrowserWindow() {
  (globalThis as { window?: unknown }).window = {};
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("authCache", () => {
  it("caches the resolved session in the browser", async () => {
    // Arrange
    withBrowserWindow();
    const { readAuthCache, writeAuthCache } = await loadCache();

    // Act
    writeAuthCache(true);

    // Assert
    expect(readAuthCache()).toBe(true);
  });

  it("never caches on the server, so one request cannot serve another's session", async () => {
    // Arrange — node environment, no `window`.
    const { readAuthCache, writeAuthCache } = await loadCache();

    // Act
    writeAuthCache(true);

    // Assert
    expect(readAuthCache()).toBeUndefined();
  });

  it("clears the cache so the next navigation re-checks", async () => {
    // Arrange
    withBrowserWindow();
    const { clearAuthCache, readAuthCache, writeAuthCache } = await loadCache();
    writeAuthCache(false);

    // Act
    clearAuthCache();

    // Assert
    expect(readAuthCache()).toBeUndefined();
  });
});
