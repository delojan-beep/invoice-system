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
    <div className="flex flex-col gap-8">
      <h1 className="text-title font-medium text-ink-900">Users</h1>

      <Card title={`${users.length} people`}>
        <ul className="divide-y divide-ink-100">
          {users.map((u) => (
            <li key={u.id}>
              <Link
                href={`/admin/users/${u.id}`}
                className="-mx-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 transition-colors duration-150 hover:bg-ink-50 sm:-mx-6 sm:px-6"
              >
                <span className="min-w-0">
                  <span className="block font-medium text-ink-900">
                    {u.name}
                    {u.employee_code && u.roles.includes("employee") && (
                      <span className="ml-2 font-mono text-sm text-ink-600">{u.employee_code}</span>
                    )}
                  </span>
                  <span className="block text-sm text-ink-600">{u.email}</span>
                </span>
                <span className="flex items-center gap-2 text-sm">
                  <span className="text-ink-600">{u.roles.join(", ")}</span>
                  {u.status === "inactive" && (
                    <span className="rounded-full bg-ink-200 px-2 py-0.5 font-medium text-ink-700">Inactive</span>
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
