import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSession, requireCollegeSession } from "@/lib/auth";

export const runtime = "nodejs";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type FeedbackRow = {
  sourceId: string;
  title: string;
  category?: string | null;
  confidence?: number | null;
  approved: boolean;
};

/** POST: log reviewed candidates. GET ?sourceId=: approval rate for a document. */
export async function POST(request: Request) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;

  try {
    const body = (await request.json()) as { rows?: FeedbackRow[] };
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) {
      return NextResponse.json({ error: "No feedback rows" }, { status: 400 });
    }

    const payload = rows
      .filter((row) => row.sourceId && row.title?.trim())
      .map((row) => ({
        source_id: row.sourceId,
        title: row.title.trim().slice(0, 300),
        category: row.category?.slice(0, 80) ?? null,
        confidence:
          typeof row.confidence === "number" && Number.isFinite(row.confidence)
            ? row.confidence
            : null,
        approved: Boolean(row.approved),
        actor_id: session.member.id,
        actor_name: session.member.displayName,
      }));

    if (!payload.length) {
      return NextResponse.json({ error: "No valid feedback rows" }, { status: 400 });
    }

    const { error } = await admin().schema("college").from("extraction_feedback").insert(payload);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, count: payload.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save feedback";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;

  const sourceId = new URL(request.url).searchParams.get("sourceId")?.trim();
  if (!sourceId) {
    return NextResponse.json({ error: "sourceId required" }, { status: 400 });
  }

  try {
    const { data, error } = await admin()
      .schema("college")
      .from("extraction_feedback")
      .select("approved")
      .eq("source_id", sourceId);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const total = rows.length;
    const approved = rows.filter((row) => row.approved).length;
    return NextResponse.json({
      sourceId,
      total,
      approved,
      rate: total ? approved / total : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load feedback";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
