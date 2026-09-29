/**
 * Client-safe Data Sources helpers: labels, ordering, filters and diagram layout.
 * No data imports here so the page bundle stays light; the registry lives in
 * lib/data-sources.ts (server).
 */

import type { DataSource, Feature, SourceType, Status } from "./data-sources";

export const FEATURES: { id: Feature; name: string }[] = [
  { id: "schools", name: "Schools" },
  { id: "finances", name: "Finances" },
  { id: "applications", name: "Applications" },
  { id: "trip", name: "Trip" },
  { id: "ingest", name: "Ingest" },
  { id: "calendar", name: "Calendar" },
];

export const FEATURE_LABELS: Record<Feature, string> = {
  schools: "Schools",
  finances: "Finances",
  applications: "Applications",
  trip: "Trip",
  ingest: "Ingest",
  calendar: "Calendar",
};

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  platform: "Platform",
  live: "Live API",
  snapshot: "Snapshot",
  linkout: "Link-out",
  outbound: "Outbound",
};

export const STATUS_LABELS: Record<Status, string> = {
  ok: "Working",
  stale: "Stale",
  failing: "Failing",
  untested: "Untested",
  no_date: "No date",
};

/** Dot color bucket. Untested shares the stale (amber) dot. */
export type StatusTone = "ok" | "stale" | "failing" | "nodate";

export function statusTone(status: Status): StatusTone {
  if (status === "ok") return "ok";
  if (status === "failing") return "failing";
  if (status === "no_date") return "nodate";
  return "stale";
}

const STATUS_ORDER: Record<Status, number> = {
  failing: 0,
  stale: 1,
  untested: 1,
  no_date: 2,
  ok: 3,
};

/** Failing first, then stale/untested, then no_date, then ok; within a band, by name. */
export function sortForList(sources: DataSource[]): DataSource[] {
  return [...sources].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name),
  );
}

/** Failing, stale and untested sources. No-date snapshots are shown but not counted. */
export function needAttentionCount(sources: DataSource[]): number {
  return sources.filter((s) => needsAttention(s)).length;
}

export function needsAttention(source: Pick<DataSource, "status">): boolean {
  return source.status === "failing" || source.status === "stale" || source.status === "untested";
}

/** Worst status among a set of sources (for feature chips). */
export function worstStatus(sources: DataSource[]): Status {
  let worst: Status = "ok";
  for (const s of sources) if (STATUS_ORDER[s.status] < STATUS_ORDER[worst]) worst = s.status;
  return worst;
}

export const DS_FILTERS = ["All", "Live", "Snapshot", "Link-out", "Outbound", "Needs attention"] as const;
export type DsFilter = (typeof DS_FILTERS)[number];

export function matchesFilter(source: DataSource, filter: DsFilter): boolean {
  switch (filter) {
    case "All":
      return true;
    case "Live":
      return source.type === "live" || source.type === "platform";
    case "Snapshot":
      return source.type === "snapshot";
    case "Link-out":
      return source.type === "linkout";
    case "Outbound":
      return source.type === "outbound";
    default:
      return needsAttention(source);
  }
}

export const DIAGRAM_WIDTH = 1320;
export const DIAGRAM_HEIGHT = 770;
const CHIP_TOP = 172;
const CHIP_GAP = 70;

export function chipY(index: number): number {
  return CHIP_TOP + index * CHIP_GAP;
}

export function diagramPositions(
  sources: DataSource[],
): Record<string, { x: number; y: number; w: number }> {
  const pos: Record<string, { x: number; y: number; w: number }> = {};
  const byType = (type: SourceType) => sources.filter((s) => s.type === type);
  byType("live").forEach((s, i) => {
    pos[s.id] = { x: 0, y: 110 + i * 40, w: 290 };
  });
  byType("snapshot").forEach((s, i) => {
    pos[s.id] = { x: 1030, y: 130 + i * 40, w: 290 };
  });
  byType("linkout").forEach((s, i) => {
    pos[s.id] = { x: i * 232, y: 712, w: 220 };
  });
  byType("outbound").forEach((s) => {
    pos[s.id] = { x: 1030, y: 712, w: 290 };
  });
  return pos;
}

export type DiagramLine = { key: string; d: string; sourceId: string; feature: Feature | null; dashed: boolean };

/** Bezier paths from each source to the feature chips it feeds, per the 1a "Wired" layout. */
export function diagramLines(sources: DataSource[]): DiagramLine[] {
  const pos = diagramPositions(sources);
  const featureIndex = (id: Feature) => FEATURES.findIndex((f) => f.id === id);
  const lines: DiagramLine[] = [];
  for (const s of sources) {
    const p = pos[s.id];
    if (!p) continue;
    if (s.type === "live" || s.type === "snapshot") {
      for (const f of s.feeds) {
        const y1 = p.y + 17;
        const y2 = chipY(featureIndex(f)) + 22;
        const x1 = s.type === "live" ? 290 : 1030;
        const x2 = s.type === "live" ? 535 : 785;
        const m = (x1 + x2) / 2;
        lines.push({ key: `${s.id}:${f}`, sourceId: s.id, feature: f, dashed: false, d: `M${x1} ${y1} C${m} ${y1} ${m} ${y2} ${x2} ${y2}` });
      }
    } else if (s.type === "linkout") {
      for (const f of s.feeds) {
        const x1 = p.x + 110;
        const x2 = 545 + featureIndex(f) * 40;
        lines.push({ key: `${s.id}:${f}`, sourceId: s.id, feature: f, dashed: true, d: `M${x1} 712 C${x1} 660 ${x2} 680 ${x2} 624` });
      }
    } else if (s.type === "outbound") {
      const y = chipY(featureIndex("calendar")) + 22;
      lines.push({ key: `${s.id}:calendar`, sourceId: s.id, feature: "calendar", dashed: true, d: `M1175 712 C1175 640 900 ${y} 785 ${y}` });
    }
  }
  return lines;
}

function shortDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${m}/${d}/${y?.slice(2)}`;
}

export function formatCheckedAt(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Never";
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (date.toDateString() === now.toDateString()) return `Today, ${time}`;
  const day = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${day}, ${time}`;
}

/** Short right-aligned label on a diagram node. */
export function nodeMeta(source: DataSource, now = new Date()): string {
  if (source.type === "live" || source.type === "platform") {
    if (source.status === "failing") return source.statusLabel === "Failing" ? "Error" : source.statusLabel;
    if (source.status === "untested") return "Untested";
    const at = source.lastSuccessAt ?? source.lastCheckedAt;
    if (!at) return "OK";
    const date = new Date(at);
    return date.toDateString() === now.toDateString()
      ? `OK ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(/\s?[AP]M$/, "")}`
      : `OK ${date.toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}`;
  }
  if (source.type === "snapshot") return source.importedAt ? shortDate(source.importedAt) : "No date";
  if (source.type === "linkout") {
    return source.coverage ? `${source.coverage.have} of ${source.coverage.total}` : source.statusLabel;
  }
  return source.tokenStatus === "set" ? "Token set" : "No token";
}

export function feedsLabel(source: DataSource): string {
  if (source.feeds.length === FEATURES.length) return "All features";
  return source.feeds.map((f) => FEATURE_LABELS[f]).join(", ");
}
