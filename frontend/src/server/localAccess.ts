// Loopback-only personal app. Public deployments must explicitly use demo mode.
export function isDemoMode(): boolean { return process.env.YOUINC_DEMO === '1'; }
export function allowLocalRequest(url: string, origin: string | null): boolean {
  try {
    const target = new URL(url);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)) return false;
    return origin === null || origin === target.origin;
  } catch { return false; }
}
