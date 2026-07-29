// Published morning brief — Claude (or a scheduled job) writes one row per
// weekday into `morning_briefs`. The home page reads today's Eastern date,
// falling back to the most recent row when today isn't ready yet.

import "server-only";
import {
  createPublicServiceRoleClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { etToday } from "@/lib/dates";

export interface PublishedMorningBrief {
  id: string;
  briefDate: string; // YYYY-MM-DD
  contentMd: string;
  createdAt: string;
  /** True when we're showing a prior day's brief because today has none. */
  isStale: boolean;
}

type BriefRow = {
  id: string;
  brief_date: string;
  content_md: string;
  created_at: string;
};

function hasConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function toBrief(row: BriefRow, today: string): PublishedMorningBrief {
  return {
    id: row.id,
    briefDate: row.brief_date,
    contentMd: row.content_md,
    createdAt: row.created_at,
    isStale: row.brief_date !== today,
  };
}

/** Fetch from one schema client; returns null on empty / soft errors. */
async function fetchFrom(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: { from: (t: string) => any },
  today: string
): Promise<PublishedMorningBrief | null> {
  const todayRes = await sb
    .from("morning_briefs")
    .select("id,brief_date,content_md,created_at")
    .eq("brief_date", today)
    .maybeSingle();

  if (todayRes.error) throw todayRes.error;
  if (todayRes.data) return toBrief(todayRes.data as BriefRow, today);

  const latestRes = await sb
    .from("morning_briefs")
    .select("id,brief_date,content_md,created_at")
    .order("brief_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestRes.error) throw latestRes.error;
  if (latestRes.data) return toBrief(latestRes.data as BriefRow, today);
  return null;
}

/**
 * Today's published brief (ET), or the most recent prior one.
 * Missing table / config / any query failure → null (empty state), never throws.
 */
export async function getPublishedMorningBrief(): Promise<PublishedMorningBrief | null> {
  if (!hasConfig()) return null;
  const today = etToday();

  // Prefer public (typical landing spot for an external publisher), then the
  // jasonos schema. Either missing table is treated as "no brief yet".
  try {
    const brief = await fetchFrom(createPublicServiceRoleClient(), today);
    if (brief) return brief;
  } catch (err) {
    console.warn("[morning-brief] public.morning_briefs unavailable:", err);
  }

  try {
    return await fetchFrom(createServiceRoleClient(), today);
  } catch (err) {
    console.warn("[morning-brief] jasonos.morning_briefs unavailable:", err);
    return null;
  }
}
