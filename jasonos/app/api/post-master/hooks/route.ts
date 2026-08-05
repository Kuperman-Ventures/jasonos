import { NextResponse } from "next/server";
import { callClaudeJson } from "@/lib/post-master/anthropic";
import {
  buildHooksUserPrompt,
  buildSystemPrompt,
} from "@/lib/post-master/promptTemplates";
import {
  normalizeConfig,
  type ConfiguratorState,
  type Hook,
} from "@/lib/post-master/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type HooksResponse = { hooks: Hook[] };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      idea?: string;
      config?: Partial<ConfiguratorState>;
    };

    const idea = body.idea?.trim() ?? "";
    if (!idea) {
      return NextResponse.json({ error: "Idea text is required." }, { status: 400 });
    }

    const config = normalizeConfig(body.config);
    const data = await callClaudeJson<HooksResponse>({
      system: buildSystemPrompt(config),
      user: buildHooksUserPrompt(idea),
      maxTokens: 1500,
    });

    if (!Array.isArray(data.hooks) || data.hooks.length < 3) {
      return NextResponse.json(
        { error: "Model did not return 3 hooks." },
        { status: 502 }
      );
    }

    const hooks: Hook[] = data.hooks.slice(0, 3).map((h, i) => ({
      id: h.id?.trim() || `h${i + 1}`,
      angle: h.angle?.trim() || `Angle ${i + 1}`,
      text: h.text?.trim() || "",
    }));

    if (hooks.some((h) => !h.text)) {
      return NextResponse.json(
        { error: "One or more hooks were empty." },
        { status: 502 }
      );
    }

    return NextResponse.json({ hooks });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Hook generation failed.";
    console.error("[post-master.hooks]", err);
    const status = message.includes("ANTHROPIC_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
