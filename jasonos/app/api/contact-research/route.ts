import { NextResponse } from "next/server";
import { getContactResearch } from "@/lib/outreach/contact-research-store";
import { runContactResearch } from "@/lib/outreach/person-research";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const contactId = new URL(req.url).searchParams.get("contactId")?.trim() ?? "";
  if (!contactId) {
    return NextResponse.json(
      { brief: null, researchedAt: null },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
  try {
    const research = await getContactResearch(contactId);
    return NextResponse.json(research, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[api.contact-research.GET]", err);
    return NextResponse.json(
      { brief: null, researchedAt: null },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}

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
    const result = await runContactResearch(contactId);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[api.contact-research.POST]", err);
    const message =
      err instanceof Error && err.message.trim()
        ? err.message.trim()
        : "Couldn't run the web search.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
