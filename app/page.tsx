import { redirect } from "next/navigation";
import { homePath } from "@/src/auth/access";
import { requireAccess } from "@/src/auth/dal";

// Waits for the access check on the server before rendering (see Cache Components docs).
export const instant = false;

// Sends each viewer to two-factor, or to the home page of their main role.
export default async function Home() {
  const viewer = await requireAccess();
  redirect(homePath(viewer.roles));
}
