import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";
import { scanNoteForEventDate } from "@/lib/note-calendar";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;

  try {
    const body = (await request.json()) as {
      title?: string;
      body?: string | null;
      previewSummary?: string | null;
      url?: string | null;
      assetUrl?: string | null;
      mimeType?: string | null;
    };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ error: "Note title is required." }, { status: 400 });
    }

    const scan = await scanNoteForEventDate({
      title,
      body: body.body,
      previewSummary: body.previewSummary,
      url: body.url,
      assetUrl: body.assetUrl,
      mimeType: body.mimeType,
    });

    return NextResponse.json({
      date: scan.date,
      source: scan.source,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not scan note for a date";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
