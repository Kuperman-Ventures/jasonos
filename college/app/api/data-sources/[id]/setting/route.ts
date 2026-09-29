import { NextResponse } from "next/server";
import { clearSavedCollegeAiModelCache, isAiModelOption } from "@/lib/ai-model";
import { isSession, isSuperAdmin, requireCollegeSession } from "@/lib/auth";
import { saveAiModelSetting } from "@/lib/data-source-settings";
import { loadDataSourcesPayload } from "@/lib/data-sources-server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Only the admin can change data source settings." }, { status: 403 });
  }

  const { id } = await context.params;
  if (id !== "ai-gateway") {
    return NextResponse.json({ error: `${id} has no editable setting.` }, { status: 400 });
  }

  let value: unknown;
  try {
    value = ((await request.json()) as { value?: unknown }).value;
  } catch {
    return NextResponse.json({ error: "Send JSON: { value }" }, { status: 400 });
  }
  if (typeof value !== "string" || !isAiModelOption(value)) {
    return NextResponse.json({ error: "Pick one of the listed AI models." }, { status: 400 });
  }

  try {
    await saveAiModelSetting(value);
    clearSavedCollegeAiModelCache();
    return NextResponse.json(await loadDataSourcesPayload(true));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the AI model";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
