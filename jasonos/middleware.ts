import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isJasonosEmail } from "@/lib/auth/allowlist";
import { isAuthorizedCronRequest } from "@/lib/auth/cron";
import {
  PUBLIC_SURFACE_HEADER,
  isCronPath,
  isPublicJasonosPath,
} from "@/lib/auth/public-routes";
import {
  JASONOS_UNLOCK_COOKIE,
  authConfigured,
  isUnlockStampFresh,
  safeNextPath,
} from "@/lib/auth/session";

function nextWithPublicHeader(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(PUBLIC_SURFACE_HEADER, "1");
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(PUBLIC_SURFACE_HEADER, "1");
  return response;
}

function redirectToLogin(request: NextRequest, error?: string) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = "";
  const next = safeNextPath(`${request.nextUrl.pathname}${request.nextUrl.search}`);
  if (next !== "/") login.searchParams.set("next", next);
  if (error) login.searchParams.set("error", error);
  return NextResponse.redirect(login);
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (isPublicJasonosPath(pathname)) {
    return nextWithPublicHeader(request);
  }

  if (isCronPath(pathname) && request.nextUrl.searchParams.get("source") === "cron") {
    if (!isAuthorizedCronRequest(request)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.next({ request });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.next({ request });
  }

  if (!anon || !authConfigured()) {
    return redirectToLogin(request, "auth_not_configured");
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) {
    return redirectToLogin(request);
  }
  if (!isJasonosEmail(user.email)) {
    await supabase.auth.signOut();
    return redirectToLogin(request, "not_jason");
  }
  if (!isUnlockStampFresh(request.cookies.get(JASONOS_UNLOCK_COOKIE)?.value)) {
    return redirectToLogin(request, "expired");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
