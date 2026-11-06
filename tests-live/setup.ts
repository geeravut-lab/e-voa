// Maps the short SB_* variables used by the scripts to the names the app reads, before any app module is imported.
import { randomBytes } from "node:crypto";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= process.env.SB_URL;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= process.env.SB_ANON;
process.env.SUPABASE_SERVICE_ROLE_KEY ??= process.env.SB_SERVICE;
process.env.DATA_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");   // throw-away key for the test run
process.env.NO_PROXY = [process.env.NO_PROXY, "127.0.0.1", "localhost"].filter(Boolean).join(",");
