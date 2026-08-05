import { NextResponse } from "next/server";
import { callClaudeText } from "@/lib/post-master/anthropic";
import {
  buildBlogUserPrompt,
  buildLinkedInUserPrompt,
  buildSystemPrompt,
} from "@/lib/post-master/promptTemplates";
import {
  normalizeConfig,
  type ConfiguratorState,
  type Hook,
} from "@/lib/post-master/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      idea?: string;
      hook?: Partial<Hook>;
      config?: Partial<ConfiguratorState>;
    };

    const idea = body.idea?.trim() ?? "";
    const hookText = body.hook?.text?.trim() ?? "";
    const hookAngle = body.hook?.angle?.trim() || "Chosen hook";

    if (!idea) {
      return NextResponse.json({ error: "Idea text is required." }, { status: 400 });
    }
    if (!hookText) {
      return NextResponse.json({ error: "A chosen hook is required." }, { status: 400 });
    }

    const config = normalizeConfig(body.config);
    const system = buildSystemPrompt(config);
    const shared = { idea, hookText, hookAngle, config };

    // Two plain-text calls in parallel — no giant JSON blob that can truncate mid-parse.
    const [linkedinRaw, blogRaw] = await Promise.all([
      callClaudeText({
        system,
        user: buildLinkedInUserPrompt(shared),
        maxTokens: 1200,
      }),
      callClaudeText({
        system,
        user: buildBlogUserPrompt(shared),
        maxTokens: 4500,
      }),
    ]);

    const linkedin = linkedinRaw.trim();
    const blog = blogRaw.trim();
    if (!linkedin || !blog) {
      return NextResponse.json(
        { error: "Model returned incomplete linkedin/blog output." },
        { status: 502 }
      );
    }

    return NextResponse.json({ linkedin, blog });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed.";
    console.error("[post-master.generate]", err);
    const status = message.includes("ANTHROPIC_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
