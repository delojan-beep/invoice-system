"use client";

import { ROLES } from "@/src/auth/access";
import { Btn, Input, Label, Message, Select } from "@/src/ui/controls";
import { useFormAction } from "@/src/ui/use-form-action";
import type { FormState } from "../actions";

const ROLE_LABELS = { employee: "Employee", approver: "Approver (CEO)", accounts: "Accounts", admin: "Admin" } as const;

export type UserValues = {
  name: string;
  email: string;
  roles: string[];
  employeeCode: string;
  defaultCurrency: string;
  timezone: string;
  address: string;
  nicOrTin: string;
  wiseRef: string;
};

export function UserForm({
  action,
  initial,
  currencies,
  timezones,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial: UserValues;
  currencies: string[];
  timezones: string[];
  submitLabel: string;
}) {
  const [state, run, pending] = useFormAction(action);

  return (
    <form onSubmit={run} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Label text="Name">
          <Input name="name" defaultValue={initial.name} required maxLength={200} />
        </Label>
        <Label text="Email" hint="They sign in with a link sent here">
          <Input name="email" type="email" defaultValue={initial.email} required />
        </Label>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-zinc-700">Roles</legend>
        <div className="flex flex-wrap gap-4">
          {ROLES.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm text-zinc-800">
              <input type="checkbox" name="roles" value={r} defaultChecked={initial.roles.includes(r)} className="h-4 w-4" />
              {ROLE_LABELS[r]}
            </label>
          ))}
        </div>
        <p className="text-xs text-zinc-500">Approver, accounts and admin must set up two-factor sign-in.</p>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-3">
        <Label text="Employee code" hint="In invoice numbers, e.g. E014">
          <Input name="employeeCode" defaultValue={initial.employeeCode} maxLength={10} className="uppercase" />
        </Label>
        <Label text="Default currency">
          <Select name="defaultCurrency" defaultValue={initial.defaultCurrency}>
            <option value="">None</option>
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Label>
        <Label text="Timezone">
          <Select name="timezone" defaultValue={initial.timezone}>
            {timezones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </Select>
        </Label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Label text="Address" hint="Printed on their invoice PDFs">
          <textarea
            name="address"
            rows={2}
            defaultValue={initial.address}
            maxLength={500}
            className="rounded-md border border-zinc-300 px-3 py-2 text-base text-zinc-900 focus:border-blue-600 focus:outline-none sm:text-sm"
          />
        </Label>
        <div className="flex flex-col gap-3">
          <Label text="NIC or TIN" hint="Printed on their invoice PDFs">
            <Input name="nicOrTin" defaultValue={initial.nicOrTin} maxLength={50} />
          </Label>
          <Label text="Wise recipient reference">
            <Input name="wiseRef" defaultValue={initial.wiseRef} maxLength={200} />
          </Label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Btn type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Btn>
        <Message error={state.error} message={state.message} />
      </div>
    </form>
  );
}
