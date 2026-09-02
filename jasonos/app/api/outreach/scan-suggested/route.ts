// POST /api/outreach/scan-suggested — Suggested "Scan" button.
// Lives on an API route so Vercel will give it 5 minutes. The same work as a
// server action was getting killed at ~15s, before the 90-day inbox pass
// finished.

import { NextResponse } from "next/server";
import { scanSuggestedContacts } from "@/lib/server-actions/contact-candidates";
import { humanScanError } from "@/lib/outreach/suggested-scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  try {
    const result = await scanSuggestedContacts();
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: humanScanError(err) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
