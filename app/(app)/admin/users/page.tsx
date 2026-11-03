import Link from "next/link";
import { requireAccess } from "@/src/auth/dal";
import { getReferenceLists, listUsers, timezones } from "@/src/domain/admin-queries";
import { nextEmployeeCode } from "@/src/domain/employee-code";
import { Card } from "@/src/ui/controls";
import { createUser } from "../actions";
import { UserForm } from "./user-form";

// Waits for the access check on the server before rendering (see Cache Components docs).
export const instant = false;

export default async function UsersPage() {
  await requireAccess(["admin"]);
  const [users, lists] = await Promise.all([listUsers(), getReferenceLists()]);
  const currencies = lists.currencies.filter((c) => c.active).map((c) => c.code);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900">Users</h1>

      <Card title={`${users.length} people`}>
        <ul className="divide-y divide-zinc-100">
          {users.map((u) => (
            <li key={u.id}>
              <Link
                href={`/admin/users/${u.id}`}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 hover:bg-zinc-50"
              >
                <span className="min-w-0">
                  <span className="block font-medium text-zinc-900">
                    {u.name}
                    {u.employee_code && u.roles.includes("employee") && (
                      <span className="ml-2 font-mono text-xs text-zinc-500">{u.employee_code}</span>
                    )}
                  </span>
                  <span className="block text-xs text-zinc-500">{u.email}</span>
                </span>
                <span className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-600">{u.roles.join(", ")}</span>
                  {u.status === "inactive" && (
                    <span className="rounded-full bg-zinc-200 px-2 py-0.5 font-medium text-zinc-700">Inactive</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Add a person">
        <UserForm
          action={createUser}
          currencies={currencies}
          timezones={timezones()}
          submitLabel="Add person"
          nextCode={nextEmployeeCode(users.map((u) => u.employee_code))}
          initial={{
            name: "",
            email: "",
            roles: ["employee"],
            employeeCode: "",
            defaultCurrency: "LKR",
            timezone: "Asia/Colombo",
            address: "",
            nicOrTin: "",
            wiseRef: "",
          }}
        />
      </Card>
    </div>
  );
}
