#!/usr/bin/env node
// Usage: node scripts/grant-admin.mjs <email> [--owner]
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
// The user must have signed in to the app at least once. The first admin should be created with --owner.
import { createClient } from "@supabase/supabase-js";

const [email, flag] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!email || !url || !key) {
  console.error("Usage: NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/grant-admin.mjs <email> [--owner]");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const { data: users, error } = await db.auth.admin.listUsers({ perPage: 1000 });
if (error) { console.error("Cannot list users:", error.message); process.exit(1); }
const user = users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) { console.error("No account with that email. Sign in to the app once first."); process.exit(1); }
const { error: e2 } = await db.from("admins").upsert({ user_id: user.id, is_owner: flag === "--owner" });
if (e2) { console.error("Failed:", e2.message); process.exit(1); }
console.log(`Granted admin${flag === "--owner" ? " (owner)" : ""} to ${email}`);
