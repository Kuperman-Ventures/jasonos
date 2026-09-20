import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";
import { fetchUrlText, suggestStepsFromText } from "@/lib/ingest";

export async function POST(request: Request) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;

  try {
    const body = (await request.json()) as {
      text?: string;
      url?: string;
      title?: string;
      kind?: "paste" | "url" | "file";
    };

    let text = typeof body.text === "string" ? body.text.trim() : "";
    let kind = body.kind ?? "paste";
    let title = typeof body.title === "string" ? body.title.trim() : "";

    if (!text && typeof body.url === "string" && body.url.trim()) {
      kind = "url";
      const url = body.url.trim();
      title = title || url;
      text = await fetchUrlText(url);
    }

    if (!text) {
      return NextResponse.json({ error: "Paste some text, or provide a URL." }, { status: 400 });
    }

    const { suggestions, method } = await suggestStepsFromText(text);
    return NextResponse.json({
      suggestions,
      method,
      source: {
        id: crypto.randomUUID(),
        title: title || (kind === "url" ? "URL ingest" : "Pasted notes"),
        kind,
        text,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not parse ingest";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
