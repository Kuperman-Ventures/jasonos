/** Shared "This Week" health math — port of calendarWeekHealthModel.js */

export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export interface GCalEvent {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
}

export interface CalendarTag {
  track: string;
  subTrack?: string | null;
  title?: string;
  durationMin?: number;
  date?: string;
  kpiCredits?: string[];
  kpiQuantities?: Record<string, number>;
}

export interface TrackTarget {
  weekly: number;
  subTracks: Record<string, number>;
}

export interface HealthContributor {
  id: string;
  source: string;
  title: string;
  minutes: number;
  startISO: string | null;
  sortKey: string;
  dayLabel: string;
  rawSubTrack?: string | null;
  allocationBucket?: string | null;
  splitNote?: string;
  splitFromNetworking?: boolean;
}

export interface HealthModel {
  totals: Record<string, { total: number; sub: Record<string, number> }>;
  contributors: Record<string, { all: HealthContributor[]; bySub: Record<string, HealthContributor[]> }>;
}

export function eventDurationMins(ev: GCalEvent): number {
  if (!ev.start?.dateTime || !ev.end?.dateTime) return 30;
  return Math.max(
    15,
    Math.round(
      (new Date(ev.end.dateTime).getTime() - new Date(ev.start.dateTime).getTime()) / 60000
    )
  );
}

const SUB_TRACK_TO_ALLOCATION_BUCKET: Record<string, Record<string, string>> = {
  advisors: {
    "Business Development": "Networking & Business Development",
    "Networking & Business Development": "Networking & Business Development",
    Content: "Materials",
    Meetings: "Client Work",
  },
  jobSearch: {
    Networking: "Network Development & Outreach",
    "L&D": "Searching",
    Applications: "Materials",
    Admin: "Network Development & Outreach",
    Boards: "Searching",
    "Network Development & Outreach": "Network Development & Outreach",
    Searching: "Searching",
    Materials: "Materials",
  },
  ventures: {
    Growth: "Alpha",
    Research: "Product",
    Subscription: "Product",
    Build: "Product",
    Alpha: "Alpha",
    Product: "Product",
    "Beta Prep": "Beta Prep",
  },
};

export function allocationSubTrackKey(
  track: string,
  rawSubTrack: string | null | undefined,
  bucketKeys: string[]
): string | null {
  if (!rawSubTrack || !bucketKeys?.length) return null;
  const trimmed = String(rawSubTrack).trim();
  if (!trimmed) return null;
  const aliases = SUB_TRACK_TO_ALLOCATION_BUCKET[track];
  const mapped = aliases?.[trimmed] ?? trimmed;
  if (bucketKeys.includes(mapped)) return mapped;
  const lower = mapped.toLowerCase();
  return bucketKeys.find((k) => k.toLowerCase() === lower) ?? null;
}

export const COSA_ALLOCATION_DEFAULTS: Record<string, { weekly: number; subTracks: Record<string, number> }> = {
  advisors: {
    weekly: 700,
    subTracks: {
      "Networking & Business Development": 60,
      Materials: 20,
      Product: 10,
      "Client Work": 5,
      "Back Office": 5,
    },
  },
  jobSearch: {
    weekly: 700,
    subTracks: {
      "Network Development & Outreach": 75,
      Searching: 15,
      Materials: 10,
    },
  },
  ventures: {
    weekly: 500,
    subTracks: { Alpha: 70, Product: 25, "Beta Prep": 5 },
  },
  development: { weekly: 60, subTracks: {} },
  cosaAdmin: { weekly: 60, subTracks: {} },
};

export function allocationsToTrackTargets(
  allocations: Record<string, { weekly: number; subTracks: Record<string, number> }>
): Record<string, TrackTarget> {
  const result: Record<string, TrackTarget> = {};
  for (const [track, cfg] of Object.entries(allocations)) {
    const subTracks: Record<string, number> = {};
    for (const [st, pct] of Object.entries(cfg.subTracks ?? {})) {
      subTracks[st] = Math.round((pct / 100) * cfg.weekly);
    }
    result[track] = { weekly: cfg.weekly, subTracks };
  }
  return result;
}

export function buildCalendarHealthModel(
  weekEvents: GCalEvent[],
  calendarTags: Record<string, CalendarTag>,
  trackTargets: Record<string, TrackTarget>,
  weekRangeStart: string,
  weekRangeEnd: string,
  nowISO: string | null = null
): HealthModel {
  const todayStr = nowISO ? nowISO.slice(0, 10) : null;
  const totals: HealthModel["totals"] = {};
  const contributors: HealthModel["contributors"] = {};

  function ensureTrack(t: string) {
    if (!totals[t]) {
      totals[t] = { total: 0, sub: {} };
      contributors[t] = { all: [], bySub: {} };
    }
  }

  function addContribution(
    track: string,
    minutes: number,
    meta: HealthContributor,
    subKey: string | null
  ) {
    ensureTrack(track);
    contributors[track].all.push(meta);
    totals[track].total += minutes;
    if (subKey) {
      totals[track].sub[subKey] = (totals[track].sub[subKey] ?? 0) + minutes;
      if (!contributors[track].bySub[subKey]) contributors[track].bySub[subKey] = [];
      contributors[track].bySub[subKey].push(meta);
    }
  }

  const ADV_NET_SUB = "Networking & Business Development";
  const JS_NET_SUB = "Network Development & Outreach";

  function addNetworkingSplit(minutes: number, metaBase: Omit<HealthContributor, "minutes">, rawSub: string | null) {
    const h1 = Math.floor(minutes / 2);
    const h2 = minutes - h1;
    const advBucket = trackTargets.advisors?.subTracks?.[ADV_NET_SUB] != null ? ADV_NET_SUB : null;
    const jsBucket = trackTargets.jobSearch?.subTracks?.[JS_NET_SUB] != null ? JS_NET_SUB : null;
    const note = "Track: Shared Networking — time split 50/50 to Advisors and Job Search.";
    addContribution("advisors", h1, { ...metaBase, minutes: h1, id: `${metaBase.id}-split-adv`, splitFromNetworking: true, splitNote: note, rawSubTrack: rawSub, allocationBucket: advBucket }, advBucket);
    addContribution("jobSearch", h2, { ...metaBase, minutes: h2, id: `${metaBase.id}-split-js`, splitFromNetworking: true, splitNote: note, rawSubTrack: rawSub, allocationBucket: jsBucket }, jsBucket);
  }

  for (const ev of weekEvents) {
    if (nowISO && ev.start?.dateTime && ev.start.dateTime > nowISO) continue;
    const priv = ev.extendedProperties?.private ?? {};
    const track = priv.cosaTrack || null;
    const subTrack = priv.cosaSubTrack || null;
    if (!track) continue;
    const dur = eventDurationMins(ev);
    const startISO = ev.start?.dateTime ?? null;
    const dayLabel = startISO
      ? new Date(startISO).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
      : "—";
    const metaBase = { id: `gcal-${ev.id}`, source: "cosa-calendar", title: ev.summary ?? "(untitled)", minutes: dur, startISO, sortKey: startISO || "", dayLabel };

    if (track === "networking") { addNetworkingSplit(dur, metaBase, subTrack); continue; }
    const bucketKeys = Object.keys(trackTargets[track]?.subTracks ?? {});
    const subKey = allocationSubTrackKey(track, subTrack, bucketKeys);
    addContribution(track, dur, { ...metaBase, rawSubTrack: subTrack, allocationBucket: subKey }, subKey);
  }

  for (const [gcalId, tag] of Object.entries(calendarTags)) {
    const { track, subTrack, durationMin, date: tagDate } = tag;
    if (!track || !durationMin) continue;
    if (!tagDate || tagDate < weekRangeStart || tagDate > weekRangeEnd) continue;
    if (todayStr && tagDate > todayStr) continue;
    const dayLabel = tagDate
      ? new Date(`${tagDate}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
      : "—";
    const metaBase = { id: `tag-${gcalId}`, source: "personal-tagged", title: tag.title || "(tagged event)", minutes: durationMin, startISO: null, sortKey: `${tagDate}T12:00:00`, dayLabel };

    if (track === "networking") { addNetworkingSplit(durationMin, metaBase, subTrack ?? null); continue; }
    const bucketKeys = Object.keys(trackTargets[track]?.subTracks ?? {});
    const subKey = allocationSubTrackKey(track, subTrack ?? null, bucketKeys);
    addContribution(track, durationMin, { ...metaBase, rawSubTrack: subTrack ?? null, allocationBucket: subKey }, subKey);
  }

  return { totals, contributors };
}
