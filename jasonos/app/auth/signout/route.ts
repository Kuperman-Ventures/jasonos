import { NextResponse } from "next/server";
import { JASONOS_UNLOCK_COOKIE } from "@/lib/auth/session";
import { createAuthServerClient } from "@/lib/supabase/server";

async function signOut(request: Request) {
  const auth = await createAuthServerClient();
  await auth.auth.signOut();
  const response = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  response.cookies.set(JASONOS_UNLOCK_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

export async function POST(request: Request) {
  return signOut(request);
}

export async function GET(request: Request) {
  return signOut(request);
}
