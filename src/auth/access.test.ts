import { describe, expect, it } from "vitest";
import { decideAccess, homePath, needsPasswordSetup, type ViewerState } from "./access";

const employee: ViewerState = {
  signedIn: true,
  active: true,
  roles: ["employee"],
  aal: "aal1",
  hasVerifiedFactor: false,
  needsPassword: false,
};

describe("decideAccess", () => {
  it("sends signed-out visitors to login", () => {
    expect(decideAccess({ ...employee, signedIn: false })).toBe("login");
  });

  it("blocks inactive users and users without roles", () => {
    expect(decideAccess({ ...employee, active: false })).toBe("inactive");
    expect(decideAccess({ ...employee, roles: [] })).toBe("inactive");
  });

  it("asks for a password after two-factor, before anything else", () => {
    expect(decideAccess({ ...employee, needsPassword: true }, ["employee"])).toBe("set-password");
    expect(decideAccess({ ...employee, roles: ["admin"], needsPassword: true })).toBe("enroll-mfa");
    expect(decideAccess({ ...employee, roles: ["admin"], aal: "aal2", needsPassword: true })).toBe("set-password");
  });

  it("only asks people who arrived by email link", () => {
    expect(needsPasswordSetup({ amr: [{ method: "otp" }] })).toBe(true);
    expect(needsPasswordSetup({ amr: [{ method: "totp" }, { method: "magiclink" }] })).toBe(true);
    expect(needsPasswordSetup({ amr: [{ method: "password" }] })).toBe(false);
    expect(needsPasswordSetup({ amr: [{ method: "oauth" }] })).toBe(false);
    expect(needsPasswordSetup({ amr: [{ method: "otp" }], user_metadata: { password_set: true } })).toBe(false);
    expect(needsPasswordSetup({})).toBe(false);
  });

  it("lets employees in without two-factor", () => {
    expect(decideAccess(employee, ["employee"])).toBe("ok");
  });

  it("makes privileged users enroll two-factor first", () => {
    expect(decideAccess({ ...employee, roles: ["approver"] }, ["approver"])).toBe("enroll-mfa");
  });

  it("makes privileged users with a factor verify it", () => {
    const ceo: ViewerState = { ...employee, roles: ["approver"], hasVerifiedFactor: true };
    expect(decideAccess(ceo, ["approver"])).toBe("verify-mfa");
    expect(decideAccess({ ...ceo, aal: "aal2" }, ["approver"])).toBe("ok");
  });

  it("requires two-factor even on employee pages when the user also holds a privileged role", () => {
    const both: ViewerState = { ...employee, roles: ["employee", "admin"], hasVerifiedFactor: true };
    expect(decideAccess(both, ["employee"])).toBe("verify-mfa");
  });

  it("forbids pages for roles the user lacks", () => {
    expect(decideAccess(employee, ["approver"])).toBe("forbidden");
    expect(decideAccess({ ...employee, roles: ["accounts"], aal: "aal2" }, ["admin"])).toBe("forbidden");
  });
});

describe("homePath", () => {
  it("prefers the approver queue, then accounts, admin and employee", () => {
    expect(homePath(["employee", "approver"])).toBe("/approver");
    expect(homePath(["employee", "admin"])).toBe("/admin");
    expect(homePath(["employee"])).toBe("/employee");
    expect(homePath([])).toBe("/login");
  });
});
