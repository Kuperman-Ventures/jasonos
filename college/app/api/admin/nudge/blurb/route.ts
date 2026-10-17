import { NextResponse } from "next/server";
import { isSession, isSuperAdmin, requireCollegeSession } from "@/lib/auth";
import { generateNudgeBlurb } from "@/lib/nudge-ai";
import { clampBlurb } from "@/lib/nudge";
import { saveNudgeBlurb } from "@/lib/nudge-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const body = (await request.json()) as {
    itemId?: string;
    title?: string;
    context?: string;
    blurb?: string;
  };
  const itemId = body.itemId?.trim() ?? "";
  if (!itemId) return NextResponse.json({ error: "Missing item" }, { status: 400 });
  try {
    if (itemId === "opening" && typeof body.blurb === "string") {
      const blurb = body.blurb.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 800);
      await saveNudgeBlurb(itemId, blurb);
      return NextResponse.json({ itemId, blurb });
    }
    if (typeof body.blurb === "string") {
      const blurb = clampBlurb(body.blurb);
      await saveNudgeBlurb(itemId, blurb);
      return NextResponse.json({ itemId, blurb });
    }
    const blurb = await generateNudgeBlurb(body.title?.trim() || itemId, body.context?.trim() || "");
    if (blurb) await saveNudgeBlurb(itemId, blurb);
    return NextResponse.json({ itemId, blurb });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the line";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
