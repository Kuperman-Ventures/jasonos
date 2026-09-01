// Inbox Dispatch — reply-triage engine for the JasonOS home page.
//
// Reuses the read-only Gmail adapter (searchGmailThreads / getGmailThread) to
// find the threads that genuinely need a reply FROM Jason, separates them from
// the machine noise (GitHub bots, job alerts, newsletters), and drafts each
// reply in Jason's voice via callClaude + JASON_CORE_VOICE.
//
// Read-only by design: this never creates or sends anything in Gmail. Drafts
// are returned as text; the UI offers Copy + a deep-link into the thread so
// Jason writes/sends from Gmail himself. The never-send rule is structural —
// there is no compose/send scope here.

import "server-only";

import {
  searchGmailThreads,
  getGmailThread,
  isGmailConnected,
  type GmailThreadFull,
  type GmailThreadMessage,
} from "@/lib/integrations/gmail";
import { gmailThreadUrl } from "@/lib/integrations/gmail-links";
import { isFromMe } from "@/lib/outreach/email-matching";
import { callClaude } from "@/lib/ai/models";
import { JASON_CORE_VOICE } from "@/lib/ai/jason-identity";

export type Urgency = "now" | "soon" | "paid" | "normal";

export interface BoardingItem {
  threadId: string;
  name: string;
  email: string;
  subject: string;
  receivedAt: string;
  gmailUrl: string;
  /** One-line "elevator door closing" reason this needs Jason. */
  elevator: string;
  urgency: Urgency;
  /** Draft reply in Jason's voice. Empty string if drafting was unavailable. */
  draft: string;
  /**
   * True when a real Gmail reply draft is already saved for this thread. Only
   * the publisher sets this — the in-app engine below is read-only and has no
   * compose scope, so a live dispatch always leaves it undefined.
   */
  draftSaved?: boolean;
  /** Deep link to that saved draft, when the publisher supplies one. */
  draftUrl?: string;
}

export interface HoldingItem {
  threadId: string;
  name: string;
  subject: string;
  gmailUrl: string;
  ageDays: number;
  note: string;
}

export interface NoiseGroup {
  label: string;
  count: number;
  /** True when count is a floor (hit the page-size cap). */
  approx: boolean;
}

export interface InboxDispatch {
  configured: boolean;
  generatedAt: string;
  error?: string;
  boarding: BoardingItem[];
  holding: HoldingItem[];
  noise: NoiseGroup[];
  noiseTotal: number;
  /**
   * "published" — the morning triage agent's run, read from
   * public.inbox_dispatches. It searches wider than the live engine and saves
   * real Gmail drafts, so it's preferred whenever a row exists.
   * "live" — computed in-process by computeInboxDispatch() below.
   */
  source?: "published" | "live";
  /** ET date (YYYY-MM-DD) of a published dispatch. */
  dispatchDate?: string;
  /** True when the published dispatch on screen isn't for today's ET date. */
  isStale?: boolean;
}

const MAX_THREAD_FETCHES = 14; // bound latency + Gmail rate limits
const MAX_BOARDING = 6;
const MAX_HOLDING = 5;

function emptyDispatch(configured: boolean, error?: string): InboxDispatch {
  return {
    configured,
    generatedAt: new Date().toISOString(),
    error,
    boarding: [],
    holding: [],
    noise: [],
    noiseTotal: 0,
  };
}

function lastMessage(t: GmailThreadFull): GmailThreadMessage | null {
  return t.messages.length ? t.messages[t.messages.length - 1] : null;
}

function parseSender(from: string | undefined): { email: string; name: string } {
  if (!from) return { email: "", name: "" };
  const m = from.match(/^(.*?)<([^>]+)>$/);
  if (m) {
    return {
      name: m[1].trim().replace(/^"|"$/g, ""),
      email: m[2].trim().toLowerCase(),
    };
  }
  return { email: from.trim().toLowerCase(), name: "" };
}

/** Returns a noise-category label when the sender is a machine/list, else null. */
function classifyNoise(email: string, name: string, subject: string): string | null {
  const e = email.toLowerCase();
  const s = subject.toLowerCase();
  const n = name.toLowerCase();

  if (
    e.includes("notifications@github.com") ||
    e.endsWith("@noreply.github.com") ||
    n.includes("github") ||
    /\bpr #\d+\b/.test(s) ||
    e.includes("vercel") ||
    n.includes("vercel")
  ) {
    return "GitHub & deploy bots";
  }
  if (
    e.includes("jobalerts") ||
    e.includes("jobs-noreply") ||
    e.endsWith("@lensa.com") ||
    e.includes("indeed.com") ||
    (e.includes("linkedin.com") && /(job|hiring|apply)/.test(s)) ||
    (e.includes("google.com") && /job/.test(s))
  ) {
    return "Job alerts";
  }
  if (
    e.includes("tldrnewsletter.com") ||
    e.includes("substack.com") ||
    e.includes("newsletters-noreply") ||
    e.includes("messages-noreply@linkedin.com") ||
    e.includes("news@") ||
    /newsletter|digest|weekly|brief #/.test(s)
  ) {
    return "Newsletters & digests";
  }
  if (
    e.includes("no-reply@zoom.us") ||
    e.includes("calendar-notification") ||
    e.includes("invitations@linkedin.com") ||
    /^(reminder:|accepted:|declined:|invitation)/.test(s)
  ) {
    return "Reminders & confirmations";
  }
  return null;
}

/** Strip quoted history and signatures to give Claude a clean last message. */
function cleanBody(msg: GmailThreadMessage): string {
  const raw = msg.plaintextBody || msg.snippet || "";
  const cut = raw.split(/\n\s*On .*wrote:\s*$/m)[0] ?? raw;
  return cut.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 900);
}

function daysSince(dateStr: string | undefined): number {
  if (!dateStr) return 0;
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.round((Date.now() - t) / 86_400_000));
}

interface DraftedReply {
  id: string;
  elevator: string;
  urgency: Urgency;
  draft: string;
}

/** One batched Claude call → elevator line + urgency + draft for each thread. */
async function draftReplies(
  items: { id: string; name: string; email: string; subject: string; body: string }[]
): Promise<Map<string, DraftedReply>> {
  const out = new Map<string, DraftedReply>();
  if (items.length === 0) return out;

  const system = `${JASON_CORE_VOICE}

You are triaging Jason's inbox and drafting REPLIES to people who are waiting on him. These are replies to known counterparties in an existing thread, so match the warmth of the incoming message — warmer and more personal than cold outreach, while still Jason's direct, concrete style.

For EACH thread you receive, return:
- "elevator": one crisp sentence (max ~22 words) naming what the sender needs and why it matters now — the "elevator door is closing" summary.
- "urgency": one of "now" (a date/deadline/RSVP within ~48h), "paid" (a billable expert-network or client call request), "soon" (a live ask worth a same-day reply), or "normal".
- "draft": a ready-to-send reply body in Jason's voice. 2–5 sentences. First-name opening. Sign off "- Jason" or "Best, Jason". NEVER invent facts, numbers, availability, or commitments Jason has not made — if he owes info he does not have, write a brief holding reply ("chasing that down, will circle back in a few days"). For scheduling, you may propose a concrete window but keep it easy to adjust.

Return ONLY a JSON array, no prose, shaped:
[{"id":"<thread id>","elevator":"...","urgency":"now|paid|soon|normal","draft":"..."}]`;

  const user = JSON.stringify(
    items.map((i) => ({ id: i.id, from: `${i.name} <${i.email}>`, subject: i.subject, message: i.body }))
  );

  try {
    const text = await callClaude({
      model: "claude-sonnet-4-6",
      maxTokens: 2200,
      system,
      messages: [{ role: "user", content: user }],
    });
    const jsonStr = extractJsonArray(text);
    const parsed = JSON.parse(jsonStr) as DraftedReply[];
    for (const r of parsed) {
      if (!r || typeof r.id !== "string") continue;
      out.set(r.id, {
        id: r.id,
        elevator: String(r.elevator ?? "").trim(),
        urgency: normalizeUrgency(r.urgency),
        draft: String(r.draft ?? "").trim(),
      });
    }
  } catch (err) {
    console.error("[inbox-triage] draft generation failed:", err);
  }
  return out;
}

function normalizeUrgency(v: unknown): Urgency {
  return v === "now" || v === "paid" || v === "soon" ? v : "normal";
}

function extractJsonArray(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("[");
  const end = body.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return "[]";
  return body.slice(start, end + 1);
}

async function countNoise(): Promise<{ groups: NoiseGroup[]; total: number }> {
  const PAGE = 40;
  const queries: { label: string; q: string }[] = [
    { label: "GitHub & deploy bots", q: "in:inbox newer_than:3d from:notifications@github.com" },
    {
      label: "Job alerts",
      q: "in:inbox newer_than:3d (from:lensa.com OR from:indeed.com OR from:jobalerts-noreply@linkedin.com OR subject:(job alert))",
    },
    {
      label: "Newsletters & digests",
      q: "in:inbox newer_than:3d (from:tldrnewsletter.com OR from:substack.com OR from:newsletters-noreply@linkedin.com)",
    },
  ];
  const results = await Promise.all(
    queries.map(async (item) => {
      const threads = await searchGmailThreads({ query: item.q, pageSize: PAGE });
      return { label: item.label, count: threads.length, approx: threads.length >= PAGE };
    })
  );
  const groups = results.filter((g) => g.count > 0);
  const total = groups.reduce((sum, g) => sum + g.count, 0);
  return { groups, total };
}

export async function computeInboxDispatch(): Promise<InboxDispatch> {
  if (!(await isGmailConnected())) return emptyDispatch(false);

  try {
    const candidates = await searchGmailThreads({
      query: "in:inbox -from:me newer_than:14d",
      pageSize: MAX_THREAD_FETCHES,
    });

    const threads = (
      await Promise.all(candidates.map((t) => getGmailThread(t.id)))
    ).filter((t): t is GmailThreadFull => Boolean(t && t.messages.length));

    const boardingRaw: {
      threadId: string;
      name: string;
      email: string;
      subject: string;
      receivedAt: string;
      body: string;
    }[] = [];
    const holding: HoldingItem[] = [];

    for (const t of threads) {
      const last = lastMessage(t);
      if (!last) continue;
      const subject = last.subject ?? "(no subject)";
      const gmailUrl = gmailThreadUrl(t.id);

      if (isFromMe(last.from ?? "")) {
        // Ball is in their court — a possible nudge, not a reply.
        if (holding.length < MAX_HOLDING) {
          const firstOther = t.messages.find((m) => !isFromMe(m.from ?? ""));
          const other = parseSender(firstOther?.from ?? last.to);
          holding.push({
            threadId: t.id,
            name: other.name || other.email || "your contact",
            subject,
            gmailUrl,
            ageDays: daysSince(last.date),
            note: "You sent the last message — waiting on their reply.",
          });
        }
        continue;
      }

      const sender = parseSender(last.from);
      if (classifyNoise(sender.email, sender.name, subject)) continue; // machine/list

      boardingRaw.push({
        threadId: t.id,
        name: sender.name || sender.email,
        email: sender.email,
        subject,
        receivedAt: last.date ? new Date(last.date).toISOString() : new Date().toISOString(),
        body: cleanBody(last),
      });
    }

    const top = boardingRaw.slice(0, MAX_BOARDING);
    const [drafts, noise] = await Promise.all([
      draftReplies(top.map((b) => ({ id: b.threadId, name: b.name, email: b.email, subject: b.subject, body: b.body }))),
      countNoise(),
    ]);

    const boarding: BoardingItem[] = top.map((b) => {
      const d = drafts.get(b.threadId);
      return {
        threadId: b.threadId,
        name: b.name,
        email: b.email,
        subject: b.subject,
        receivedAt: b.receivedAt,
        gmailUrl: gmailThreadUrl(b.threadId),
        elevator: d?.elevator || `${b.name} is waiting on your reply.`,
        urgency: d?.urgency ?? "normal",
        draft: d?.draft ?? "",
      };
    });

    // Bubble the most time-sensitive to the top.
    const rank: Record<Urgency, number> = { now: 0, paid: 1, soon: 2, normal: 3 };
    boarding.sort((a, b) => rank[a.urgency] - rank[b.urgency]);

    return {
      configured: true,
      generatedAt: new Date().toISOString(),
      boarding,
      holding,
      noise: noise.groups,
      noiseTotal: noise.total,
    };
  } catch (err) {
    console.error("[inbox-triage] compute failed:", err);
    return emptyDispatch(true, err instanceof Error ? err.message : String(err));
  }
}
