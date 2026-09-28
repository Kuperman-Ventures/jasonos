// GET /api/browning-networking/run?source=cron
// POST /api/browning-networking/run
//
// Finds Tracy's handoff emails, proposes times, and writes morning cards.
// Also writes the call brief and thank-you draft when a meeting is booked.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { runBrowningNetworking } from "@/lib/browning-networking/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(req: Request) {
  const url = new URL(req.url);
  const isCron = url.searchParams.get("source") === "cron";
  const refresh = url.searchParams.get("refresh") === "1";
  if (!isCron && !refresh && req.method !== "POST") {
    return NextResponse.json(
      { error: "pass ?refresh=1, POST, or ?source=cron" },
      { status: 400 }
    );
  }

  const secret = process.env.CRON_SECRET;
  if (isCron && secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const result = await runBrowningNetworking();
  revalidatePath("/outreach/browning-networking");
  revalidatePath("/");
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}
