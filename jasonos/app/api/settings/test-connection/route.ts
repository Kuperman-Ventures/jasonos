import { NextResponse } from "next/server";
import {
  TestConnectionSchema,
  persistConnectionHealth,
  testServiceConnection,
} from "@/lib/settings/actions";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = TestConnectionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Invalid payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const result = await testServiceConnection(
      parsed.data.service_name,
      parsed.data.credentials ?? {}
    );
    // Keep the Settings badge in sync: a green toast must clear a sticky error row.
    try {
      await persistConnectionHealth(parsed.data.service_name, result);
    } catch {
      // Auth/DB write failure shouldn't hide the probe result from the toast.
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Connection test failed",
        health_status: "down",
      },
      { status: error instanceof Error && error.message === "not_authenticated" ? 401 : 500 }
    );
  }
}
