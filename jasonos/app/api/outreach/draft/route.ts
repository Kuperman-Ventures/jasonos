import { NextResponse } from "next/server";
import { generateOutreachDraft } from "@/lib/server-actions/outreach-draft";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { contactId?: string };
    const contactId = body.contactId?.trim() ?? "";
    if (!contactId) {
      return NextResponse.json(
        { ok: false, error: "contactId is required." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    const result = await generateOutreachDraft({ contactId });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[api.outreach.draft.POST]", err);
    const message =
      err instanceof Error && err.message.trim()
        ? err.message.trim()
        : "Couldn't write the draft.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
