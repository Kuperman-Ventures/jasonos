import { NextResponse } from "next/server";
import { createSchool, listSchools, supabaseConfigured } from "@/lib/db";

export async function GET() {
  try {
    const schools = await listSchools();
    return NextResponse.json({ persisted: supabaseConfigured(), schools });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read schools";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }
  const body = (await request.json()) as { name?: string };
  try {
    const school = await createSchool(body.name ?? "");
    return NextResponse.json({ school });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add school";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
