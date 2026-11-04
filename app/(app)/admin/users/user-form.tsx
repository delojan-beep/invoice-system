"use client";

import { CheckedForm } from "@/src/ui/checked-form";
import { useState } from "react";
import { ROLES } from "@/src/auth/access";
import { Btn, Input, Label, Message, Select, Textarea } from "@/src/ui/controls";
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
  nextCode,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial: UserValues;
  currencies: string[];
  timezones: string[];
  submitLabel: string;
  nextCode: string;
}) {
  const [state, run, pending] = useFormAction(action);
  const [isEmployee, setIsEmployee] = useState(initial.roles.includes("employee"));

  return (
    <CheckedForm onSubmit={run} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Label text="Name">
          <Input name="name" defaultValue={initial.name} required maxLength={200} />
        </Label>
        <Label text="Email" hint="We email their invitation here">
          <Input name="email" type="email" defaultValue={initial.email} required />
        </Label>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-base font-medium text-ink-700">Roles</legend>
        <div className="flex flex-wrap gap-4">
          {ROLES.map((r) => (
            <label key={r} className="flex min-h-11 cursor-pointer items-center gap-3 text-base text-ink-800">
              <input
                type="checkbox"
                name="roles"
                value={r}
                defaultChecked={initial.roles.includes(r)}
                onChange={r === "employee" ? (event) => setIsEmployee(event.target.checked) : undefined}
                className="size-5"
              />
              {ROLE_LABELS[r]}
            </label>
          ))}
        </div>
        <p className="text-sm text-ink-600">Approver, accounts and admin must set up two-factor sign-in.</p>
      </fieldset>

      <div className={`grid gap-3 ${isEmployee ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {isEmployee && (
          <Label text="Employee code" hint="Given automatically. Used in their invoice numbers.">
            <output className="flex min-h-11 items-center rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-base font-normal text-ink-800">
              {initial.employeeCode || nextCode}
            </output>
          </Label>
        )}
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
          <Textarea
            name="address"
            rows={2}
            defaultValue={initial.address}
            maxLength={500}
          />
        </Label>
        <div className="flex flex-col gap-3">
          <Label text="NIC or passport" hint="Number printed on their invoice PDFs">
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
    </CheckedForm>
  );
}
