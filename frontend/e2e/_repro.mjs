import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage();
const client = await page.context().newCDPSession(page);
await client.send("WebAuthn.enable");
await client.send("WebAuthn.addVirtualAuthenticator", {
  options: {
    protocol: "ctap2",
    transport: "internal",
    hasResidentKey: true,
    hasUserVerification: true,
    isUserVerified: true,
    automaticPresenceSimulation: true,
  },
});

page.on("response", async (res) => {
  const u = res.url();
  if (u.includes("Registration") || u.includes("finishReg") || u.includes("beginReg") || u.includes("_serverFn")) {
    let body = "";
    try { body = await res.text(); } catch {}
    console.log("RESP", res.status(), u.slice(0, 90), "::", body.slice(0, 400));
  }
});

const email = `e2e-passkey-${Date.now()}@example.com`;
await page.goto("http://localhost:3000/signup");
await page.waitForLoadState("networkidle");
await page.getByLabel("Email").fill(email);
await page.getByRole("button", { name: /continue/i }).click();
await page.waitForTimeout(1200);
await page.getByRole("button", { name: /continue/i }).click();
await page.waitForTimeout(1200);
await page.getByRole("button", { name: /create a passkey/i }).click();
await page.waitForTimeout(3500);
console.log("URL:", page.url());
console.log("H1:", await page.locator("h1").first().textContent().catch(()=>"?"));
await browser.close();
