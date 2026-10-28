export const ROLES = ["employee", "approver", "accounts", "admin"] as const;
export type AppRole = (typeof ROLES)[number];

// Roles that can see other people's invoices; they must sign in with two-factor.
export const PRIVILEGED_ROLES: readonly AppRole[] = ["approver", "accounts", "admin"];

export type ViewerState = {
  signedIn: boolean;
  active: boolean;
  roles: readonly AppRole[];
  aal: "aal1" | "aal2";
  hasVerifiedFactor: boolean;
};

export type AccessDecision = "ok" | "login" | "inactive" | "enroll-mfa" | "verify-mfa" | "forbidden";

export function needsTwoFactor(roles: readonly AppRole[]) {
  return roles.some((r) => PRIVILEGED_ROLES.includes(r));
}

/**
 * Decides whether a viewer may open a page. `anyOf` lists the roles that may
 * open it; an empty list means any active user.
 */
export function decideAccess(viewer: ViewerState, anyOf: readonly AppRole[] = []): AccessDecision {
  if (!viewer.signedIn) return "login";
  if (!viewer.active || viewer.roles.length === 0) return "inactive";

  if (needsTwoFactor(viewer.roles) && viewer.aal !== "aal2") {
    return viewer.hasVerifiedFactor ? "verify-mfa" : "enroll-mfa";
  }

  if (anyOf.length > 0 && !anyOf.some((r) => viewer.roles.includes(r))) return "forbidden";
  return "ok";
}

const HOME_BY_ROLE: Record<AppRole, string> = {
  approver: "/approver",
  accounts: "/accounts",
  admin: "/admin",
  employee: "/employee",
};

// Where a viewer lands after sign-in: the first role in this order.
export function homePath(roles: readonly AppRole[]) {
  const order: AppRole[] = ["approver", "accounts", "admin", "employee"];
  const role = order.find((r) => roles.includes(r));
  return role ? HOME_BY_ROLE[role] : "/login";
}

export function rolePath(role: AppRole) {
  return HOME_BY_ROLE[role];
}
