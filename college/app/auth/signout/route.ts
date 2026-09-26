import { NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const auth = await createAuthServerClient();
  await auth.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}

export async function GET(request: Request) {
  const auth = await createAuthServerClient();
  await auth.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url));
}
