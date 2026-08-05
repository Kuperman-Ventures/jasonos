import { NextResponse } from "next/server";
import { callClaudeJson } from "@/lib/post-machine/anthropic";
import {
  buildGenerateUserPrompt,
  buildSystemPrompt,
} from "@/lib/post-machine/promptTemplates";
import {
  normalizeConfig,
  type ConfiguratorState,
  type Hook,
} from "@/lib/post-machine/types";

export const runtime = "nodejs";
export const maxDuration = 120;

type GenerateResponse = { linkedin: string; blog: string };

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
    const data = await callClaudeJson<GenerateResponse>({
      system: buildSystemPrompt(config),
      user: buildGenerateUserPrompt({
        idea,
        hookText,
        hookAngle,
        config,
      }),
      maxTokens: 4500,
    });

    const linkedin = data.linkedin?.trim() ?? "";
    const blog = data.blog?.trim() ?? "";
    if (!linkedin || !blog) {
      return NextResponse.json(
        { error: "Model returned incomplete linkedin/blog output." },
        { status: 502 }
      );
    }

    return NextResponse.json({ linkedin, blog });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed.";
    console.error("[post-machine.generate]", err);
    const status = message.includes("ANTHROPIC_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
