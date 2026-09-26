import { randomBytes } from "node:crypto";
import { collegeDb, supabaseConfigured } from "@/lib/db";

const STATE_ID = "kyle-college";

export function newCalendarFeedToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Env override wins; otherwise read/create token on app_state. */
export async function resolveCalendarFeedToken(): Promise<string | null> {
  const fromEnv = process.env.COLLEGE_ICAL_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  if (!supabaseConfigured()) {
    return process.env.COLLEGE_ICAL_TOKEN?.trim() || "local-dev-ical-token";
  }

  const db = collegeDb();
  const { data, error } = await db
    .from("app_state")
    .select("calendar_feed_token")
    .eq("id", STATE_ID)
    .maybeSingle();
  if (error) throw error;
  const existing =
    data && typeof (data as { calendar_feed_token?: unknown }).calendar_feed_token === "string"
      ? (data as { calendar_feed_token: string }).calendar_feed_token.trim()
      : "";
  if (existing) return existing;

  const token = newCalendarFeedToken();
  const { error: writeError } = await db.from("app_state").upsert({
    id: STATE_ID,
    calendar_feed_token: token,
    updated_at: new Date().toISOString(),
  });
  if (writeError) throw writeError;
  return token;
}

export async function loadCalendarEventsForFeed(): Promise<
  import("@/lib/calendar-events").CalendarEvent[]
> {
  const { normalizeCalendarEvents } = await import("@/lib/calendar-events");
  if (!supabaseConfigured()) return [];
  const db = collegeDb();
  const { data, error } = await db
    .from("app_state")
    .select("calendar_events")
    .eq("id", STATE_ID)
    .maybeSingle();
  if (error) throw error;
  return normalizeCalendarEvents(
    data ? (data as { calendar_events?: unknown }).calendar_events : [],
  );
}

export function tokensMatch(provided: string | null, expected: string): boolean {
  if (!provided || !expected) return false;
  if (provided.length !== expected.length) return false;
  let ok = 0;
  for (let i = 0; i < provided.length; i += 1) {
    ok |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return ok === 0;
}
