import { NextResponse } from "next/server";
import {
  SetServiceEnabledSchema,
  setServiceEnabled,
} from "@/lib/settings/actions";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = SetServiceEnabledSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const result = await setServiceEnabled(parsed.data);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "set_enabled_failed" },
      { status: error instanceof Error && error.message === "not_authenticated" ? 401 : 500 }
    );
  }
}
