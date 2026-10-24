import "server-only";

import { notify } from "@/lib/notify";
import { loadFamilyMeetingAgenda } from "./agenda";
import { buildPrintPackPayload } from "./print-pack";
import {
  freezeFridayKeyFor,
  isFridayFreezeWindow,
  printWeekFromFreezeFriday,
} from "./print-window";
import {
  getLatestPrintPack,
  markPrintPackEmailed,
  savePrintPack,
} from "./store";

export type FreezeResult =
  | {
      ok: true;
      skipped?: boolean;
      reason?: string;
      packId?: string;
      freezeFriday?: string;
      label?: string;
      printPath?: string;
    }
  | { ok: false; error: string };

/**
 * Freeze the Sat→next-Sunday print pack for the Friday night window.
 * Idempotent per freeze_friday.
 */
export async function freezeFamilyMeetingPrintPack(input?: {
  now?: Date;
  force?: boolean;
  baseUrl?: string;
}): Promise<FreezeResult> {
  const now = input?.now ?? new Date();
  if (!input?.force && !isFridayFreezeWindow(now)) {
    // Allow Saturday early UTC cron: treat as last night’s Friday if no pack yet.
    const friday = freezeFridayKeyFor(now);
    const latest = await getLatestPrintPack().catch(() => null);
    if (latest?.freeze_friday === friday) {
      return {
        ok: true,
        skipped: true,
        reason: "pack_already_exists",
        packId: latest.id,
        freezeFriday: friday,
        label: latest.label,
      };
    }
    // Only auto-create outside the exact minute window when forced, or when
    // today ET is Saturday (cron fires ~4:00 UTC Sat ≈ Fri 11:59pm–12am ET).
    const etWeekday = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
    }).format(now);
    if (etWeekday !== "Sat" && etWeekday !== "Fri") {
      return { ok: true, skipped: true, reason: "outside_freeze_window" };
    }
  }

  try {
    const freezeFriday = freezeFridayKeyFor(now);
    const week = printWeekFromFreezeFriday(freezeFriday);
    const agenda = await loadFamilyMeetingAgenda(now);
    const payload = buildPrintPackPayload(agenda, freezeFriday);
    const saved = await savePrintPack({ freezeFriday, payload });
    const base =
      input?.baseUrl?.replace(/\/$/, "") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://jasonos.vercel.app";
    const printPath = `/projects/family-meeting/print/${saved.id}`;

    if (saved.created || input?.force) {
      await notify({
        source: "family_meeting",
        title: `Family Meeting print pack · ${week.label}`,
        body: [
          `Frozen Fri ${freezeFriday} 11:59pm ET.`,
          `Covers ${week.label} (Sat → next Sunday).`,
          `Print 4 sheets: ${base}${printPath}`,
          "Open that page and Print / Save as PDF (one sheet per page).",
        ].join("\n"),
        severity: "info",
        category: "deadline",
      });
      await markPrintPackEmailed(saved.id).catch(() => undefined);
    }

    return {
      ok: true,
      packId: saved.id,
      freezeFriday,
      label: week.label,
      printPath,
      skipped: !saved.created && !input?.force,
      reason: saved.created ? undefined : "updated_existing",
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
