"use server";

import { revalidatePath } from "next/cache";
import {
  scanWebinarCandidates,
  setWebinarSessionStatus,
} from "@/lib/webinars/store";

function revalidate() {
  revalidatePath("/webinars");
}

export async function confirmSession(id: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    await setWebinarSessionStatus({ id, status: "confirmed" });
    revalidate();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function dismissSession(id: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    await setWebinarSessionStatus({ id, status: "dismissed" });
    revalidate();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function rescanNow(): Promise<
  { ok: true; new_or_updated: number; errors: string[] } | { ok: false; error: string }
> {
  try {
    const before = Date.now();
    const result = await scanWebinarCandidates({ daysBack: 14 });
    revalidate();
    return {
      ok: true,
      new_or_updated: result.sessions.filter(
        (s) => Date.parse(s.updated_at) >= before - 5_000
      ).length,
      errors: result.errors,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
