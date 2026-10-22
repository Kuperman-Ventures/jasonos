import { NextResponse } from "next/server";
import { researchWeeklyProvocation } from "@/lib/post-master/weekly-provocation/prepare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { id?: string; force?: boolean };
    const id = body.id?.trim() ?? "";
    if (!id) {
      return NextResponse.json({ error: "Missing provocation." }, { status: 400 });
    }
    const result = await researchWeeklyProvocation(id, { force: body.force === true });
    if (!result.ok && "busy" in result) {
      return NextResponse.json({ busy: true });
    }
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ item: result.item });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not prepare that brief.";
    console.error("[weekly-provocation.research]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
