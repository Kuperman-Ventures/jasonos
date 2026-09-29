import { NextResponse } from "next/server";
import { isSession, isSuperAdmin, requireCollegeSession } from "@/lib/auth";
import { loadLinkOverrides } from "@/lib/data-source-settings";
import { runSourceTest, testableSourceIds, type SourceTestResult } from "@/lib/data-source-tests";
import { loadDataSourcesPayload } from "@/lib/data-sources-server";
import { listSchools } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Leave headroom under maxDuration for writes and the reload. */
const BUDGET_MS = 48_000;

export async function POST() {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: "Only the admin can run Check all." }, { status: 403 });
  }

  const started = Date.now();
  const deadline = started + BUDGET_MS;
  try {
    const [schools, linkOverrides] = await Promise.all([listSchools(), loadLinkOverrides()]);
    const ids = testableSourceIds();
    const results: Record<string, SourceTestResult> = {};
    const skipped: string[] = [];

    await Promise.all(
      ids.map(async (id) => {
        if (Date.now() > deadline) {
          skipped.push(id);
          return;
        }
        try {
          results[id] = await runSourceTest(id, { schools, linkOverrides, deadline });
        } catch (error) {
          results[id] = { ok: false, ms: 0, message: error instanceof Error ? error.message : String(error) };
        }
      }),
    );

    const payload = await loadDataSourcesPayload(true);
    const values = Object.values(results);
    return NextResponse.json({
      ...payload,
      results,
      summary: {
        tested: values.length,
        failed: values.filter((r) => !r.ok).length,
        skipped: skipped.length,
        ms: Date.now() - started,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Check all failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
