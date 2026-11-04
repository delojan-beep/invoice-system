import { describe, expect, it } from "vitest";
import { emailLinkServiceDown, signInErrorMessage } from "./sign-in-error";

describe("emailLinkServiceDown", () => {
  it("is true only when the service itself failed", () => {
    expect(emailLinkServiceDown({ status: 0 })).toBe(true);
    expect(emailLinkServiceDown({})).toBe(true);
    expect(emailLinkServiceDown({ status: 502 })).toBe(true);
    expect(emailLinkServiceDown({ status: 503, code: "unexpected_failure" })).toBe(true);
  });

  it("stays false for refusals that could reveal whether an address has an account", () => {
    expect(emailLinkServiceDown(null)).toBe(false);
    expect(emailLinkServiceDown({ status: 422, code: "otp_disabled" })).toBe(false);
    expect(emailLinkServiceDown({ status: 429, code: "over_email_send_rate_limit" })).toBe(false);
  });
});

describe("signInErrorMessage", () => {
  it("blames the password only for a credentials failure", () => {
    const wrong = "That email and password don't match. Try again or use an email link.";
    expect(signInErrorMessage({ code: "invalid_credentials", status: 400 })).toBe(wrong);
    expect(signInErrorMessage({ status: 400, message: "Invalid login credentials" })).toBe(wrong);
  });

  it("does not blame the password when the service is down", () => {
    for (const outage of [{ status: 0 }, { status: 502 }, { status: 503, code: "unexpected_failure" }, {}]) {
      expect(signInErrorMessage(outage)).toContain("isn't working right now");
    }
  });

  it("explains rate limits, inactive accounts and unconfirmed emails", () => {
    expect(signInErrorMessage({ status: 429 })).toContain("Too many");
    expect(signInErrorMessage({ code: "over_request_rate_limit" })).toContain("Too many");
    expect(signInErrorMessage({ code: "user_banned", status: 403 })).toContain("inactive");
    expect(signInErrorMessage({ code: "email_not_confirmed", status: 400 })).toContain("Confirm your email");
  });
});
