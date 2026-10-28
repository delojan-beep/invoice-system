// Creates one local user per role. Run after `supabase db reset` (pnpm db:reset does both).
// Local development only: refuses to run against anything but localhost.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local");
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(url)) throw new Error(`Refusing to seed users on ${url}`);

const PASSWORD = "LocalDev2026"; // local only
const supabase = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

type SeedUser = {
  email: string;
  name: string;
  roles: ("employee" | "approver" | "accounts" | "admin")[];
  employee_code?: string;
  default_currency?: string;
  timezone: string;
};

const USERS: SeedUser[] = [
  { email: "admin@qnetwork.test", name: "Sam Admin", roles: ["admin"], timezone: "Asia/Colombo" },
  { email: "ceo@qnetwork.test", name: "Casey CEO", roles: ["approver"], timezone: "America/Toronto" },
  { email: "accounts@qnetwork.test", name: "Alex Accounts", roles: ["accounts"], timezone: "America/Toronto" },
  {
    email: "nimal@qnetwork.test",
    name: "Nimal Perera",
    roles: ["employee"],
    employee_code: "E014",
    default_currency: "LKR",
    timezone: "Asia/Colombo",
  },
  {
    email: "jordan@qnetwork.test",
    name: "Jordan Lee",
    roles: ["employee"],
    employee_code: "E015",
    default_currency: "CAD",
    timezone: "America/Vancouver",
  },
];

async function main() {
  for (const user of USERS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error?.code === "email_exists") {
      console.log(`  ${user.email.padEnd(26)} already exists, skipped`);
      continue;
    }
    if (error) throw new Error(`${user.email}: ${error.message}`);

    const id = data.user.id;
    const { error: profileError } = await supabase.from("profiles").insert({
      id,
      name: user.name,
      email: user.email,
      employee_code: user.employee_code ?? null,
      default_currency: user.default_currency ?? null,
      timezone: user.timezone,
    });
    if (profileError) throw new Error(`${user.email} profile: ${profileError.message}`);

    const { error: rolesError } = await supabase
      .from("user_roles")
      .insert(user.roles.map((role) => ({ user_id: id, role })));
    if (rolesError) throw new Error(`${user.email} roles: ${rolesError.message}`);

    console.log(`  ${user.email.padEnd(26)} ${user.roles.join(", ")}`);
  }
  console.log(`\nSeeded ${USERS.length} users. Password for all: ${PASSWORD}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
