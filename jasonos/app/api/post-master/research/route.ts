import { NextResponse } from "next/server";
import { runPostMasterResearch } from "@/lib/post-master/research";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      topic?: string;
      guidance?: string;
    };

    const topic = body.topic?.trim() ?? "";
    const guidance = body.guidance?.trim() ?? "";
    if (!topic) {
      return NextResponse.json({ error: "Topic is required." }, { status: 400 });
    }

    const findings = await runPostMasterResearch({ topic, guidance });
    return NextResponse.json({ findings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Research failed.";
    console.error("[post-master.research]", err);
    const status =
      message.includes("AI Gateway") || message.includes("ANTHROPIC_API_KEY")
        ? 503
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
