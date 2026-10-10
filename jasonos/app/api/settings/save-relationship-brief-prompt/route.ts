import { NextResponse } from "next/server";
import {
  SaveRelationshipBriefPromptSchema,
  saveRelationshipBriefPrompt,
} from "@/lib/settings/actions";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = SaveRelationshipBriefPromptSchema.safeParse(
    await req.json().catch(() => null)
  );
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const result = await saveRelationshipBriefPrompt(parsed.data);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "save_failed";
    return NextResponse.json(
      { ok: false, error: message },
      {
        status:
          message === "not_authenticated"
            ? 401
            : message.startsWith("Unknown variables")
              ? 400
              : 500,
      }
    );
  }
}
