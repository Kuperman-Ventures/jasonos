import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";
import { fetchLinkPreview, summarizeLinkPreview } from "@/lib/link-preview";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;

  try {
    const body = (await request.json()) as { url?: string };
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url) {
      return NextResponse.json({ error: "Provide a URL." }, { status: 400 });
    }

    const preview = await fetchLinkPreview(url);
    return NextResponse.json({
      title: preview.title,
      description: preview.description,
      imageUrl: preview.imageUrl,
      siteName: preview.siteName,
      summary: summarizeLinkPreview(preview),
      text: preview.text,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load link preview";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
