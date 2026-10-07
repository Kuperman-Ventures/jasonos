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

export const DS_FILTERS = ["All", "Live", "Snapshot", "Link-out", "Outbound", "AI", "Needs attention"] as const;
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
    case "AI":
      return isAiSource(source.id);
    default:
      return needsAttention(source);
  }
}

export const DIAGRAM_WIDTH = 1320;
export const DIAGRAM_HEIGHT = 770;
const CHIP_TOP = 192;
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

/** Where generative AI runs in the college tracker, mapped to Data Sources nodes. */
export type AiWorkflowUse = {
  id: string;
  title: string;
  where: string;
  how: string;
  review: string;
  /** Feature chip to highlight, if any. */
  feature: Feature | null;
  /** Source ids on this page (ai-gateway, perplexity, …). */
  sourceIds: string[];
};

export const AI_WORKFLOW_USES: AiWorkflowUse[] = [
  {
    id: "ingest-extract",
    title: "Ingest extraction",
    where: "Project Management › Ingest → Find to-dos / calendar events",
    how: "A model reads the pasted text, PDF, email, or rich-text note and proposes concrete to-dos and calendar events as structured rows.",
    review: "Nothing is saved until you keep, edit, or skip each row.",
    feature: "ingest",
    sourceIds: ["ai-gateway"],
  },
  {
    id: "school-lookup",
    title: "Add-school lookup",
    where: "College List › Add school",
    how: "A model calls Perplexity search to fill public admissions facts (platform, essays, recommendations, majors, deadlines). Federal stats still come from College Scorecard and dated snapshots — not from the model inventing numbers.",
    review: "Facts land on the school record for the family to edit. The prompt forbids inventing dates or counts.",
    feature: "schools",
    sourceIds: ["ai-gateway", "perplexity", "college-scorecard"],
  },
  {
    id: "activity-icon",
    title: "Activity icons",
    where: "Activities › new activity without an icon",
    how: "A short model call picks a Phosphor icon from a fixed allowlist. Keyword rules cover common names if the gateway is down.",
    review: "Cosmetic only. You can change the icon anytime.",
    feature: null,
    sourceIds: ["ai-gateway"],
  },
];

export const AI_WORKFLOW_BOUNDARIES = [
  "AI does not score admit chances, rank schools, or decide where to apply.",
  "AI does not submit applications, pay fees, or send email for you.",
  "Live APIs, dated snapshots, and link-outs still own the numbers on Finances and Requirements.",
  "Prompt text (document contents, school names, activity titles) goes to the selected model through Vercel AI Gateway for that call only.",
] as const;

/** Sources that are themselves AI (Gateway + Perplexity tool). Scorecard is listed on school-lookup as companion data, not AI. */
export const AI_MODEL_SOURCE_IDS = new Set(["ai-gateway", "perplexity"]);

export function isAiSource(sourceId: string): boolean {
  return AI_MODEL_SOURCE_IDS.has(sourceId);
}

export function featureUsesAi(feature: Feature): boolean {
  return AI_WORKFLOW_USES.some((use) => use.feature === feature);
}

export function aiUsesForSource(sourceId: string): AiWorkflowUse[] {
  return AI_WORKFLOW_USES.filter((use) => use.sourceIds.includes(sourceId));
}

export function aiUsesForFeature(feature: Feature): AiWorkflowUse[] {
  return AI_WORKFLOW_USES.filter((use) => use.feature === feature);
}

/** Short caption when an AI path is selected or hovered on the diagram. */
export function aiDiagramCaption(input: {
  sourceId?: string | null;
  feature?: Feature | null;
}): string | null {
  const fromSource = input.sourceId ? aiUsesForSource(input.sourceId) : [];
  const fromFeature = input.feature ? aiUsesForFeature(input.feature) : [];
  const uses =
    fromSource.length > 0
      ? fromSource
      : fromFeature.length > 0
        ? fromFeature
        : [];
  if (!uses.length) return null;
  const titles = [...new Set(uses.map((use) => use.title))];
  if (titles.length === 1) {
    const use = uses[0]!;
    return `AI · ${use.title} — ${use.review}`;
  }
  return `AI · ${titles.join(" · ")}`;
}
