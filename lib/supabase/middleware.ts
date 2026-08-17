import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolveValidatedNexhqActor } from "@/lib/auth/authentication";
import { decideNexhqAuthRouting } from "@/lib/auth/routing";

function copyResponseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach(({ name, value, ...options }) => {
    target.cookies.set(name, value, options);
  });
  return target;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let authenticated = false;

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    });

    const authentication = await resolveValidatedNexhqActor(() =>
      supabase.auth.getUser(),
    );
    authenticated = authentication.authenticated;
  }

  const decision = decideNexhqAuthRouting({
    pathname: request.nextUrl.pathname,
    authenticated,
  });

  if (decision.kind === "api_unauthorized") {
    return copyResponseCookies(
      supabaseResponse,
      NextResponse.json(
        {
          error: "Authentication is required.",
          code: "AUTHENTICATION_REQUIRED",
        },
        {
          status: decision.status,
          headers: { "Cache-Control": "no-store" },
        },
      ),
    );
  }

  if (decision.kind === "redirect") {
    return copyResponseCookies(
      supabaseResponse,
      NextResponse.redirect(new URL(decision.location, request.url)),
    );
  }

  return supabaseResponse;
}
