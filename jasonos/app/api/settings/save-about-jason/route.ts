import { NextResponse } from "next/server";
import { z } from "zod";
import { saveAboutJason } from "@/lib/settings/actions";

const BodySchema = z.object({
  aboutJason: z.string().max(20_000),
});

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid About Jason payload." },
        { status: 400 }
      );
    }
    const result = await saveAboutJason(parsed.data);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed.";
    const status = message === "not_authenticated" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
