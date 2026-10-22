import { cleanResearchBrief } from "@/lib/ai/research-clean";

/**
 * Parse + render helpers for AI web-search research briefs.
 * Supports the new JSON storage shape and legacy plain-text briefs.
 */

export type ResearchSource = { title: string | null; url: string };

export type ResearchBriefModel = {
  lead: string | null;
  bullets: string[];
  notes: string[];
  sources: ResearchSource[];
  empty: boolean;
};

const URL_RE = /https?:\/\/[^\s)\]>]+/i;

function stripBulletPrefix(line: string): string {
  return line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim();
}

function extractInlineUrl(text: string): { label: string; url: string | null } {
  const match = text.match(URL_RE);
  if (!match) return { label: text.trim(), url: null };
  const url = match[0].replace(/[.,;:]+$/, "");
  const label = text.replace(match[0], "").replace(/\s+[—–-]\s*$/, "").trim();
  return { label: label || url, url };
}

/** Build the JSON string we persist on meetings going forward. */
export function serializeResearchBrief(model: ResearchBriefModel): string {
  return JSON.stringify({
    version: 1,
    lead: model.lead,
    bullets: model.bullets,
    notes: model.notes,
    sources: model.sources,
    empty: model.empty,
  });
}

function tryParseJsonBrief(raw: string): ResearchBriefModel | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const data = JSON.parse(trimmed) as Partial<ResearchBriefModel> & {
      version?: number;
    };
    if (!data || typeof data !== "object") return null;
    return {
      lead: typeof data.lead === "string" && data.lead.trim() ? data.lead.trim() : null,
      bullets: Array.isArray(data.bullets)
        ? data.bullets.map((b) => String(b).trim()).filter(Boolean)
        : [],
      notes: Array.isArray(data.notes)
        ? data.notes.map((n) => String(n).trim()).filter(Boolean)
        : [],
      sources: Array.isArray(data.sources)
        ? data.sources
            .map((s) => ({
              title:
                s && typeof s === "object" && typeof (s as ResearchSource).title === "string"
                  ? (s as ResearchSource).title
                  : null,
              url:
                s && typeof s === "object" && typeof (s as ResearchSource).url === "string"
                  ? (s as ResearchSource).url
                  : "",
            }))
            .filter((s) => /^https?:\/\//i.test(s.url))
        : [],
      empty: Boolean(data.empty),
    };
  } catch {
    return null;
  }
}

/** Turn cleaned research text (or JSON) into a display model. */
export function parseResearchBrief(raw: string): ResearchBriefModel {
  const fromJson = tryParseJsonBrief(raw);
  if (fromJson) {
    if (
      fromJson.empty ||
      (fromJson.bullets.length === 0 &&
        fromJson.sources.length === 0 &&
        /no notable|no usable|nothing relevant|no results/i.test(
          fromJson.lead ?? ""
        ))
    ) {
      return { ...fromJson, empty: true };
    }
    return fromJson;
  }

  const text = cleanResearchBrief(raw).replace(/\r\n/g, "\n").trim();
  if (!text) {
    return { lead: null, bullets: [], notes: [], sources: [], empty: true };
  }

  // Split off a trailing Sources: section if present.
  const sourcesSplit = text.split(/\n\s*Sources:\s*\n/i);
  const body = (sourcesSplit[0] ?? "").trim();
  const sourcesBlock = (sourcesSplit[1] ?? "").trim();

  const sources: ResearchSource[] = [];
  for (const line of sourcesBlock.split("\n")) {
    const cleaned = stripBulletPrefix(line);
    if (!cleaned) continue;
    const { label, url } = extractInlineUrl(cleaned);
    if (url) sources.push({ title: label || null, url });
  }

  const bullets: string[] = [];
  const paragraphs: string[] = [];
  const notes: string[] = [];

  for (const block of body.split(/\n{2,}/)) {
    const chunk = block.trim();
    if (!chunk) continue;

    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    const allBullets = lines.every((l) => /^\s*(?:[-*•]|\d+[.)])\s+/.test(l));
    if (allBullets) {
      for (const l of lines) {
        const item = stripBulletPrefix(l);
        if (item) bullets.push(item);
      }
      continue;
    }

    // Mixed: pull bullet lines out, keep the rest as prose.
    const proseLines: string[] = [];
    for (const l of lines) {
      if (/^\s*(?:[-*•]|\d+[.)])\s+/.test(l)) {
        const item = stripBulletPrefix(l);
        if (item) bullets.push(item);
      } else {
        proseLines.push(l);
      }
    }
    const prose = proseLines.join(" ").trim();
    if (!prose) continue;
    if (/^\(note:/i.test(prose) || /treat the above as unverified/i.test(prose)) {
      notes.push(prose.replace(/^\(|\)$/g, "").trim());
    } else {
      paragraphs.push(prose);
    }
  }

  const lead = paragraphs[0] ?? null;
  if (paragraphs.length > 1) {
    notes.push(...paragraphs.slice(1));
  }

  const empty =
    bullets.length === 0 &&
    sources.length === 0 &&
    /no notable|no usable|nothing relevant|no results|limited public footprint/i.test(
      text
    );

  return { lead, bullets, notes, sources, empty };
}

/** Build a ResearchBriefModel from generator output + collected sources. */
export function buildResearchBriefModel(input: {
  text: string;
  sources: ResearchSource[];
  searched: boolean;
  emptyFallback: string;
}): ResearchBriefModel {
  const parsed = parseResearchBrief(input.text);
  const sources =
    input.sources.length > 0
      ? input.sources
      : parsed.sources;

  const empty =
    !input.searched ||
    parsed.empty ||
    (parsed.bullets.length === 0 && sources.length === 0);

  if (empty) {
    return {
      lead: parsed.lead || input.emptyFallback,
      bullets: [],
      notes: parsed.notes,
      sources: [],
      empty: true,
    };
  }

  return {
    lead: parsed.lead,
    bullets: parsed.bullets,
    notes: parsed.notes,
    sources,
    empty: false,
  };
}

export interface PersonCompanyResearch {
  person: ResearchBriefModel;
  company: ResearchBriefModel;
  companyName: string | null;
  title: string | null;
  website: string | null;
  linkedinUrl: string | null;
  /** True when at least one page from the company domain was read. */
  companyVerified: boolean;
}

function asShortText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.slice(0, max);
}

function asBulletList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.replace(/\s+/g, " ").trim() : ""))
    .filter(Boolean)
    .slice(0, 8);
}

function asSourceList(value: unknown): ResearchSource[] {
  if (!Array.isArray(value)) return [];
  const out: ResearchSource[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      const url = item.match(/https?:\/\/[^\s)]+/i)?.[0]?.replace(/[.,;]+$/, "") ?? "";
      if (/^https?:\/\//i.test(url)) out.push({ title: null, url });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const urlRaw = (item as { url?: unknown }).url;
    const url = typeof urlRaw === "string" ? urlRaw.trim().replace(/[.,;]+$/, "") : "";
    if (!/^https?:\/\//i.test(url)) continue;
    const title = asShortText((item as { title?: unknown }).title, 200);
    out.push({ title, url });
  }
  return out.slice(0, 8);
}

function asHttpUrl(value: unknown): string | null {
  const text = asShortText(value, 300);
  if (!text) return null;
  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function briefFromParts(lead: string | null, bullets: string[], sources: ResearchSource[]): ResearchBriefModel {
  return {
    lead,
    bullets,
    notes: [],
    sources,
    empty: !lead && bullets.length === 0 && sources.length === 0,
  };
}

/** Parse the JSON returned by the person-and-company research pass. */
export function parsePersonCompanyResearch(raw: string): PersonCompanyResearch | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const person = row.person && typeof row.person === "object" ? (row.person as Record<string, unknown>) : {};
  const company = row.company && typeof row.company === "object" ? (row.company as Record<string, unknown>) : {};
  const linkedin = asHttpUrl(row.linkedinUrl);
  return {
    person: briefFromParts(asShortText(person.lead, 600), asBulletList(person.bullets), asSourceList(person.sources)),
    company: briefFromParts(
      asShortText(company.lead, 600),
      asBulletList(company.bullets),
      asSourceList(company.sources)
    ),
    companyName: asShortText(company.name, 200),
    title: asShortText(row.title, 160),
    website: asHttpUrl(company.website),
    linkedinUrl: linkedin && /linkedin\.com\//i.test(linkedin) ? linkedin : null,
    companyVerified: false,
  };
}
