import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabase } from "@/lib/env";

/**
 * Keeps the Supabase session fresh on every page request (Next.js 16 "proxy", formerly middleware).
 * Does no access control: pages and actions check the user themselves.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!hasSupabase()) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  try {
    await supabase.auth.getUser();
  } catch {
    // Supabase unreachable: let the page render as a visitor rather than fail every request.
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|brand/|icons/|favicon.ico|manifest.webmanifest|api/live|.*\\.(?:svg|png|jpg|jpeg|webp|ico|js|css)$).*)"],
};
