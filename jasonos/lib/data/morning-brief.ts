// Published morning brief — Claude (or a scheduled job) writes one row per
// weekday into `morning_briefs`. The home page reads today's Eastern date,
// falling back to the most recent row when today isn't ready yet. The card can
// also page back to a specific prior day's brief via `?brief=YYYY-MM-DD`.

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
  /** True when the brief we're showing isn't for today's Eastern date. */
  isStale: boolean;
  /** Nearest older brief date, if one exists (for the "previous day" control). */
  prevDate: string | null;
  /** Nearest newer brief date, if one exists (for the "next day" control). */
  nextDate: string | null;
  /** True when this is the most recent brief on record. */
  isLatest: boolean;
}

type BriefRow = {
  id: string;
  brief_date: string;
  content_md: string;
  created_at: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = { from: (t: string) => any };

function hasConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function neighborsFor(
  sb: Sb,
  briefDate: string
): Promise<{ prevDate: string | null; nextDate: string | null }> {
  const [prevRes, nextRes] = await Promise.all([
    sb
      .from("morning_briefs")
      .select("brief_date")
      .lt("brief_date", briefDate)
      .order("brief_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from("morning_briefs")
      .select("brief_date")
      .gt("brief_date", briefDate)
      .order("brief_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    prevDate: (prevRes.data?.brief_date as string | undefined) ?? null,
    nextDate: (nextRes.data?.brief_date as string | undefined) ?? null,
  };
}

async function toBrief(
  sb: Sb,
  row: BriefRow,
  today: string
): Promise<PublishedMorningBrief> {
  const { prevDate, nextDate } = await neighborsFor(sb, row.brief_date);
  return {
    id: row.id,
    briefDate: row.brief_date,
    contentMd: row.content_md,
    createdAt: row.created_at,
    isStale: row.brief_date !== today,
    prevDate,
    nextDate,
    isLatest: nextDate === null,
  };
}

/**
 * Fetch a brief from one schema client.
 *   - `targetDate` set → that exact day (or null if that day has no brief).
 *   - otherwise → today's brief, falling back to the most recent one.
 * Returns null on empty / soft errors.
 */
async function fetchFrom(
  sb: Sb,
  today: string,
  targetDate?: string
): Promise<PublishedMorningBrief | null> {
  if (targetDate) {
    const res = await sb
      .from("morning_briefs")
      .select("id,brief_date,content_md,created_at")
      .eq("brief_date", targetDate)
      .maybeSingle();
    if (res.error) throw res.error;
    if (res.data) return toBrief(sb, res.data as BriefRow, today);
    return null;
  }

  const todayRes = await sb
    .from("morning_briefs")
    .select("id,brief_date,content_md,created_at")
    .eq("brief_date", today)
    .maybeSingle();

  if (todayRes.error) throw todayRes.error;
  if (todayRes.data) return toBrief(sb, todayRes.data as BriefRow, today);

  const latestRes = await sb
    .from("morning_briefs")
    .select("id,brief_date,content_md,created_at")
    .order("brief_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestRes.error) throw latestRes.error;
  if (latestRes.data) return toBrief(sb, latestRes.data as BriefRow, today);
  return null;
}

/**
 * A published brief for the home card.
 *   - No `targetDate` → today's brief (ET), or the most recent prior one.
 *   - `targetDate` (YYYY-MM-DD) → that specific day, used by the day-nav
 *     controls. Falls back to the default selection when that day is empty.
 * Missing table / config / any query failure → null (empty state), never throws.
 */
export async function getPublishedMorningBrief(
  targetDate?: string
): Promise<PublishedMorningBrief | null> {
  if (!hasConfig()) return null;
  const today = etToday();
  const wanted = /^\d{4}-\d{2}-\d{2}$/.test(targetDate ?? "")
    ? targetDate
    : undefined;

  // Prefer public (typical landing spot for an external publisher), then the
  // jasonos schema. Either missing table is treated as "no brief yet". When a
  // specific day is requested but missing in a source, fall through to the
  // default selection so navigation never dead-ends on an empty card.
  const publicSb = createPublicServiceRoleClient();
  try {
    const brief =
      (await fetchFrom(publicSb, today, wanted)) ??
      (wanted ? await fetchFrom(publicSb, today) : null);
    if (brief) return brief;
  } catch (err) {
    console.warn("[morning-brief] public.morning_briefs unavailable:", err);
  }

  try {
    const jasonSb = createServiceRoleClient();
    return (
      (await fetchFrom(jasonSb, today, wanted)) ??
      (wanted ? await fetchFrom(jasonSb, today) : null)
    );
  } catch (err) {
    console.warn("[morning-brief] jasonos.morning_briefs unavailable:", err);
    return null;
  }
}
