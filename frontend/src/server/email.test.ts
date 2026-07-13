import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildResendPayload, sendEmail } from "./email";

describe("buildResendPayload", () => {
  it("wraps a single recipient in an array and passes fields through", () => {
    expect(
      buildResendPayload("YouInc <hi@youinc.test>", {
        to: "user@example.com",
        subject: "Hi",
        html: "<p>Hi</p>",
        text: "Hi",
      }),
    ).toEqual({
      from: "YouInc <hi@youinc.test>",
      to: ["user@example.com"],
      subject: "Hi",
      html: "<p>Hi</p>",
      text: "Hi",
    });
  });
});

describe("sendEmail when unconfigured", () => {
  const savedKey = process.env.RESEND_API_KEY;
  const savedFrom = process.env.EMAIL_FROM;

  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
  });
  afterEach(() => {
    if (savedKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = savedKey;
    if (savedFrom === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = savedFrom;
  });

  it("no-ops (sent:false) without throwing or calling out", async () => {
    const result = await sendEmail({
      to: "user@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
      text: "Hi",
    });
    expect(result).toEqual({ sent: false });
  });
});
