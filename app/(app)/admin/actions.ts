"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ROLES } from "@/src/auth/access";
import { requireAccess } from "@/src/auth/dal";
import type { PostgrestError } from "@supabase/supabase-js";
import { toResult } from "@/src/domain/invoice-actions";
import { createAdminClient } from "@/src/supabase/admin";
import { createClient } from "@/src/supabase/server";

// Admin actions. requireAccess checks the admin here; row-level security
// checks it again (admin with two-factor) on every table write. The secret-key
// client is used only for Supabase Auth itself (creating, banning users).

export type FormState = { error?: string; message?: string };

/** A database error as form text (rule messages as written, others generic). */
function failed(error: PostgrestError): FormState {
  const result = toResult(null, error);
  return result.ok ? {} : { error: result.error };
}

function ok(message: string): FormState {
  refresh();
  return { message };
}

const BAN_FOREVER = "876000h"; // about 100 years; Supabase's way to block sign-in

// --- Users ------------------------------------------------------------------

const userSchema = z
  .object({
    name: z.string().trim().min(1, "Add a name").max(200),
    email: z.email("Enter a valid email address").transform((e) => e.toLowerCase()),
    roles: z.array(z.enum(ROLES)).min(1, "Give at least one role"),
    employeeCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^([A-Z0-9]{2,10})?$/, "Employee code: 2 to 10 letters or digits, e.g. E014"),
    defaultCurrency: z.string().regex(/^([A-Z]{3})?$/),
    timezone: z.string().refine((tz) => Intl.supportedValuesOf("timeZone").includes(tz), "Choose a timezone"),
    address: z.string().trim().max(500),
    nicOrTin: z.string().trim().max(50),
    wiseRef: z.string().trim().max(200),
  })
  .refine((u) => !u.roles.includes("employee") || u.employeeCode, {
    path: ["employeeCode"],
    error: "Employees need an employee code (it goes in their invoice numbers)",
  })
  .refine((u) => !u.roles.includes("employee") || u.defaultCurrency, {
    path: ["defaultCurrency"],
    error: "Employees need a default currency",
  });

function readUser(formData: FormData) {
  return userSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    roles: formData.getAll("roles"),
    employeeCode: formData.get("employeeCode") ?? "",
    defaultCurrency: formData.get("defaultCurrency") ?? "",
    timezone: formData.get("timezone"),
    address: formData.get("address") ?? "",
    nicOrTin: formData.get("nicOrTin") ?? "",
    wiseRef: formData.get("wiseRef") ?? "",
  });
}

function profileRow(u: z.output<typeof userSchema>) {
  return {
    name: u.name,
    email: u.email,
    employee_code: u.employeeCode || null,
    default_currency: u.defaultCurrency || null,
    timezone: u.timezone,
    address: u.address || null,
    nic_or_tin: u.nicOrTin || null,
    wise_recipient_ref: u.wiseRef || null,
  };
}

function friendly(message: string) {
  if (message.includes("profiles_employee_code_key")) return "That employee code is already used";
  if (message.includes("profiles_email_key") || /already been registered|email_exists/i.test(message)) {
    return "Someone already has that email address";
  }
  return null;
}

export async function createUser(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccess(["admin"]);
  const parsed = readUser(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const u = parsed.data;

  // No password: they sign in with an email link (or set one later).
  const auth = createAdminClient().auth.admin;
  const { data: created, error: authError } = await auth.createUser({ email: u.email, email_confirm: true });
  if (authError || !created.user) return { error: friendly(authError?.message ?? "") ?? "Could not create the sign-in account" };

  const supabase = await createClient();
  const id = created.user.id;
  const { error: profileError } = await supabase
    .from("profiles")
    .insert({ id, ...profileRow(u), joined_on: new Date().toISOString().slice(0, 10) });
  const { error: rolesError } = profileError
    ? { error: null }
    : await supabase.from("user_roles").insert(u.roles.map((role) => ({ user_id: id, role })));

  if (profileError || rolesError) {
    await auth.deleteUser(id); // undo, so the email can be used again
    const err = (profileError ?? rolesError)!;
    return { error: friendly(err.message) ?? failed(err).error };
  }
  redirect(`/admin/users/${id}?created=1`);
}

export async function updateUser(userId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireAccess(["admin"]);
  const parsed = readUser(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const u = parsed.data;

  if (userId === viewer.id && !u.roles.includes("admin")) {
    return { error: "You can't remove your own admin role. Ask another admin." };
  }

  const supabase = await createClient();
  const { data: before } = await supabase.from("profiles").select("email").eq("id", userId).single();

  if (before && before.email !== u.email) {
    const { error } = await createAdminClient().auth.admin.updateUserById(userId, { email: u.email, email_confirm: true });
    if (error) return { error: friendly(error.message) ?? "Could not change the sign-in email" };
  }

  const { error: profileError } = await supabase.from("profiles").update(profileRow(u)).eq("id", userId);
  if (profileError) return { error: friendly(profileError.message) ?? failed(profileError).error };

  const { data: current } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const had = (current ?? []).map((r) => r.role);
  const remove = had.filter((r) => !u.roles.includes(r));
  const add = u.roles.filter((r) => !had.includes(r));
  if (remove.length) {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).in("role", remove);
    if (error) return failed(error);
  }
  if (add.length) {
    const { error } = await supabase.from("user_roles").insert(add.map((role) => ({ user_id: userId, role })));
    if (error) return failed(error);
  }
  return ok("Saved");
}

/** Inactive: no sign-in (banned in Auth), no new monthly drafts; past invoices stay. */
export async function setUserStatus(userId: string, status: "active" | "inactive"): Promise<FormState> {
  const viewer = await requireAccess(["admin"]);
  if (userId === viewer.id && status === "inactive") return { error: "You can't make yourself inactive." };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ status }).eq("id", userId);
  if (error) return failed(error);

  const { error: banError } = await createAdminClient().auth.admin.updateUserById(userId, {
    ban_duration: status === "inactive" ? BAN_FOREVER : "none",
  });
  if (banError) return { error: `Status saved, but sign-in could not be ${status === "inactive" ? "blocked" : "restored"}: ${banError.message}` };
  return ok(status === "inactive" ? "Made inactive: they can no longer sign in" : "Active again");
}

// --- Reference lists --------------------------------------------------------

const currencySchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Currency code: 3 letters, e.g. USD"),
  name: z.string().trim().min(1, "Add the currency's name").max(100),
  symbol: z.string().trim().min(1, "Add a symbol").max(5),
  decimalPlaces: z.coerce.number().int().min(0).max(4, "0 to 4 decimal places"),
});

export async function addCurrency(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccess(["admin"]);
  const parsed = currencySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const c = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("currencies")
    .insert({ code: c.code, name: c.name, symbol: c.symbol, decimal_places: c.decimalPlaces });
  if (error?.code === "23505") return { error: `${c.code} already exists` };
  return error ? failed(error) : ok(`Added ${c.code}`);
}

const taxSchema = z.object({
  name: z.string().trim().min(1, "Name the rate, e.g. VAT 18%").max(100),
  percentage: z.coerce.number().min(0).max(100, "0 to 100 percent"),
  label: z.string().trim().min(1, "Add the label shown on invoices, e.g. VAT").max(50),
  currency: z.string().regex(/^[A-Z]{3}$/, "Choose a currency"),
});

export async function addTaxRate(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccess(["admin"]);
  const parsed = taxSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const t = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("tax_rates")
    .insert({ name: t.name, percentage: t.percentage, label: t.label, currency_code: t.currency, active: false });
  return error ? failed(error) : ok(`Added ${t.name} (switched off until you turn it on)`);
}

const lineTypeSchema = z.object({
  name: z.string().trim().min(1, "Name the line type").max(100),
  receiptRequired: z.literal("on").optional(),
});

export async function addLineType(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccess(["admin"]);
  const parsed = lineTypeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { count } = await supabase.from("line_types").select("id", { count: "exact", head: true });
  const { error } = await supabase.from("line_types").insert({
    name: parsed.data.name,
    receipt_required: parsed.data.receiptRequired === "on",
    sort_order: (count ?? 0) + 1,
  });
  if (error?.code === "23505") return { error: "A line type with that name exists" };
  return error ? failed(error) : ok(`Added ${parsed.data.name}`);
}

type Toggle = { table: "currencies" | "tax_rates" | "line_types"; key: string; field: "active" | "receipt_required"; value: boolean };

/** Switch a currency, tax rate or line type on/off (or a line type's receipt rule). */
export async function toggle({ table, key, field, value }: Toggle): Promise<FormState> {
  await requireAccess(["admin"]);
  if (field === "receipt_required" && table !== "line_types") return { error: "Not allowed" };
  const supabase = await createClient();
  const { error } =
    table === "currencies"
      ? await supabase.from("currencies").update({ active: value }).eq("code", key)
      : table === "tax_rates"
        ? await supabase.from("tax_rates").update({ active: value }).eq("id", key)
        : await supabase.from("line_types").update({ [field]: value } as { active: boolean } | { receipt_required: boolean }).eq("id", key);
  return error ? failed(error) : ok("Saved");
}

// --- Settings ---------------------------------------------------------------

const settingsSchema = z.object({
  review_period_days: z.coerce.number().int().min(1, "At least 1 day").max(60, "At most 60 days"),
  daily_summary_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Daily summary time: HH:MM"),
  monthly_day: z.coerce.number().int().min(1).max(28, "Use day 1 to 28 so every month has it"),
  monthly_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Monthly summary time: HH:MM"),
  monthly_timezone: z.string().refine((tz) => Intl.supportedValuesOf("timeZone").includes(tz), "Choose a timezone"),
  summary_recipients: z.array(z.enum(["approver", "accounts", "admin"])).min(1, "Choose who gets the monthly summary"),
  reminder_fields: z.array(z.enum(["number", "date", "total"])),
  invoice_number_format: z
    .string()
    .trim()
    .refine((f) => f.includes("{NNN}") && f.includes("{EMP}"), "The number format needs {EMP} and {NNN} so numbers stay unique")
    .refine((f) => f.length <= 60),
  base_currency: z.string().regex(/^[A-Z]{3}$/),
  wise_fee_payer: z.enum(["", "company", "deducted"]),
  company_name: z.string().trim().min(1, "Add the company name").max(200),
  company_bn: z.string().trim().max(50),
  company_address: z.string().trim().max(500),
  wording_status_update: z.string().max(1000),
  wording_daily_summary: z.string().max(1000),
  wording_deadline_warning: z.string().max(1000),
  wording_overdue_alert: z.string().max(1000),
  wording_monthly_summary: z.string().max(1000),
});

export async function saveSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireAccess(["admin"]);
  const parsed = settingsSchema.safeParse({
    ...Object.fromEntries(formData),
    summary_recipients: formData.getAll("summary_recipients"),
    reminder_fields: formData.getAll("reminder_fields"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const s = parsed.data;

  const values: Record<string, unknown> = {
    review_period_days: s.review_period_days,
    daily_summary_time: s.daily_summary_time,
    monthly_summary: { day: s.monthly_day, time: s.monthly_time, timezone: s.monthly_timezone },
    summary_recipients: s.summary_recipients,
    reminder_fields: s.reminder_fields,
    invoice_number_format: s.invoice_number_format,
    base_currency: s.base_currency,
    wise_fee_payer: s.wise_fee_payer, // "" = not decided; the column is not null, so JSON null cannot be written
    company: { name: s.company_name, business_number: s.company_bn, address: s.company_address },
    email_wording: {
      status_update: s.wording_status_update.trim(),
      daily_summary: s.wording_daily_summary.trim(),
      deadline_warning: s.wording_deadline_warning.trim(),
      overdue_alert: s.wording_overdue_alert.trim(),
      monthly_summary: s.wording_monthly_summary.trim(),
    },
  };

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("settings")
    .upsert(Object.entries(values).map(([key, value]) => ({ key, value: value as never, updated_by: viewer.id, updated_at: now })));
  return error ? failed(error) : ok("Settings saved");
}
