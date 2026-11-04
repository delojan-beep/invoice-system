import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/src/auth/dal";
import { getNextEmployeeCode, getReferenceLists, getUser, timezones } from "@/src/domain/admin-queries";
import { ActionButton } from "@/src/ui/action-button";
import { Card } from "@/src/ui/controls";
import { resendInvitation, setUserStatus, updateUser } from "../../actions";
import { UserForm } from "../user-form";

// Waits for the access check on the server before rendering (see Cache Components docs).
export const instant = false;

export default async function UserPage({ params, searchParams }: PageProps<"/admin/users/[id]">) {
  const viewer = await requireAccess(["admin"]);
  const { id } = await params;
  const { created } = await searchParams;
  const [user, lists, nextCode] = await Promise.all([getUser(id), getReferenceLists(), getNextEmployeeCode()]);
  if (!user) notFound();

  const currencies = lists.currencies.filter((c) => c.active || c.code === user.default_currency).map((c) => c.code);
  const isSelf = user.id === viewer.id;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/admin/users" className="inline-flex min-h-11 items-center text-base text-brand-700 hover:underline">
          ← Users
        </Link>
        <h1 className="mt-2 text-title font-medium text-ink-900">{user.name}</h1>
        {created === "1" && (
          <p role="status" className="mt-2 text-base text-green-700">
            Added. An invitation is on its way to {user.email}.
          </p>
        )}
        {created === "not-invited" && (
          <p role="alert" className="mt-2 text-base text-red-700">
            Added, but the invitation could not be sent. Use &ldquo;Send invitation&rdquo; below to try again.
          </p>
        )}
      </div>

      <Card title="Details">
        <UserForm
          action={updateUser.bind(null, user.id)}
          currencies={currencies}
          timezones={timezones()}
          submitLabel="Save"
          nextCode={nextCode}
          initial={{
            name: user.name,
            email: user.email,
            roles: user.roles,
            employeeCode: user.employee_code ?? "",
            defaultCurrency: user.default_currency ?? "",
            timezone: user.timezone,
            address: user.address ?? "",
            nicOrTin: user.nic_or_tin ?? "",
            wiseRef: user.wise_recipient_ref ?? "",
          }}
        />
      </Card>

      {user.status === "active" && !isSelf && (
        <Card title="Invitation">
          <div className="flex flex-col gap-3">
            <p className="text-base text-ink-600">
              Emails a new sign-in link, in case the first one expired or got lost. The link replaces any earlier one.
            </p>
            <ActionButton action={resendInvitation.bind(null, user.id)} label="Send invitation" pendingLabel="Sending…" />
          </div>
        </Card>
      )}

      <Card title="Status">
        {user.status === "active" ? (
          <div className="flex flex-col gap-3">
            <p className="text-base text-ink-600">
              Active. Making someone inactive stops them signing in and stops new monthly drafts. Their past invoices stay,
              and an invoice they already submitted can still be approved and paid.
            </p>
            {isSelf ? (
              <p className="text-base text-ink-600">You can&apos;t make yourself inactive.</p>
            ) : (
              <ActionButton
                action={setUserStatus.bind(null, user.id, "inactive")}
                label="Make inactive"
                pendingLabel="Saving…"
                variant="danger"
                confirmText={`Make ${user.name} inactive? They will be signed out and can no longer sign in.`}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-base text-ink-600">Inactive: cannot sign in, no new monthly drafts.</p>
            <ActionButton
              action={setUserStatus.bind(null, user.id, "active")}
              label="Make active again"
              pendingLabel="Saving…"
              variant="primary"
            />
          </div>
        )}
      </Card>
    </div>
  );
}
