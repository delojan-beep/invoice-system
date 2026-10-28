import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/src/supabase/server";
import { decideAccess, ROLES, type AppRole, type ViewerState } from "./access";

export type Viewer = ViewerState & {
  id: string;
  email: string;
  name: string;
  timezone: string;
};

const SIGNED_OUT: Viewer = {
  signedIn: false,
  active: false,
  roles: [],
  aal: "aal1",
  hasVerifiedFactor: false,
  id: "",
  email: "",
  name: "",
  timezone: "UTC",
};

// The signed-in user, their profile, roles and two-factor level. One lookup per render.
export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) return SIGNED_OUT;

  // listFactors checks the user with the Auth server; reading the AAL from the
  // cookie session instead would trust unverified data.
  const [{ data: profile }, { data: roleRows }, { data: factors }] = await Promise.all([
    supabase.from("profiles").select("name, email, status, timezone").eq("id", claims.sub).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", claims.sub),
    supabase.auth.mfa.listFactors(),
  ]);

  const roles = (roleRows ?? [])
    .map((r) => r.role as AppRole)
    .filter((r) => ROLES.includes(r));

  return {
    signedIn: true,
    active: profile?.status === "active",
    roles,
    aal: claims.aal === "aal2" ? "aal2" : "aal1",
    hasVerifiedFactor: (factors?.totp.length ?? 0) > 0,
    id: claims.sub,
    email: profile?.email ?? claims.email ?? "",
    name: profile?.name ?? "",
    timezone: profile?.timezone ?? "UTC",
  };
});

/**
 * Loads the viewer and redirects unless they may open this page.
 * Call at the top of every page, Server Action and Route Handler.
 */
export async function requireAccess(anyOf: readonly AppRole[] = []): Promise<Viewer> {
  const viewer = await getViewer();
  const decision = decideAccess(viewer, anyOf);

  switch (decision) {
    case "ok":
      return viewer;
    case "login":
      redirect("/login");
    case "inactive":
      redirect("/auth/signout?reason=inactive");
    case "enroll-mfa":
      redirect("/mfa/enroll");
    case "verify-mfa":
      redirect("/mfa/verify");
    case "forbidden":
      redirect("/?error=forbidden");
  }
}

// For the two-factor pages: signed in and active, two-factor not yet required.
export async function requireActiveViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer.signedIn) redirect("/login");
  if (!viewer.active || viewer.roles.length === 0) redirect("/auth/signout?reason=inactive");
  return viewer;
}
