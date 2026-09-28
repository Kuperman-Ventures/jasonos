// Reply, brief, and thank-you text. Facts come from the handoff email
// or the transcript. Nothing here is sent.

import { etYmd } from "@/lib/dates";
import { buildMailtoUrl } from "@/lib/email-templates/render";
import type { HandoffBrief, HandoffSlot, ParsedHandoff } from "./types";

const ET = "America/New_York";

export function firstName(name: string | null | undefined): string {
  const part = (name ?? "").trim().split(/\s+/)[0];
  return part || "there";
}

/** Calendar title both people see. "Call with Matthew" reads as a call with himself on his calendar. */
export function connectMeetingTitle(contactName: string): string {
  const name = contactName.trim();
  return name ? `Jason Kuperman/${name}: Connect` : "Jason Kuperman: Connect";
}

export function formatSlotLabel(iso: string): string {
  const date = new Date(iso);
  const weekday = date.toLocaleDateString("en-US", {
    timeZone: ET,
    weekday: "short",
  });
  const monthDay = date.toLocaleDateString("en-US", {
    timeZone: ET,
    month: "short",
    day: "numeric",
  });
  const time = date
    .toLocaleTimeString("en-US", {
      timeZone: ET,
      hour: "numeric",
      minute: "2-digit",
    })
    .replace(/\s/g, "")
    .toLowerCase();
  return `${weekday}. ${monthDay} @ ${time} ET`;
}

export function schedulingDraft(input: {
  name: string | null;
  slots: HandoffSlot[];
}): string {
  const who = firstName(input.name);
  const connected =
    who === "there" ? "Good to be connected." : `Good to be connected to ${who}.`;
  const lines = [...input.slots]
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .map((slot) => formatSlotLabel(slot.start));
  const times = lines.length ? lines.join("\n") : "(add times on the calendar)";
  return `Thank you Tracy - moving you to Bcc

${connected}

Let me know what might work for a call in the next few weeks.

Some options from my side would be:

${times}

Looking forward to speaking,
Jason`;
}

export function followUpDraft(name: string | null): string {
  const who = firstName(name);
  const hello = who === "there" ? "Following up." : `Following up, ${who}.`;
  return `${hello}

Let me know if any of the times I sent still work, or if another window in the next few weeks is better.

Jason`;
}

/** mailto: so the Mac opens Apple Mail with To, subject, body, and Bcc filled in. */
export function replyComposeUrl(input: {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
}): string {
  return buildMailtoUrl(input);
}

export function replySubject(subject: string | null | undefined): string {
  const clean = (subject ?? "").replace(/^\s*re:\s*/i, "").trim();
  if (!clean) return "Re: Executive Networking";
  return `Re: ${clean}`;
}

export function briefFromHandoff(parsed: ParsedHandoff): HandoffBrief {
  const name = parsed.name ?? "This contact";
  const role = [parsed.title, parsed.company].filter(Boolean).join(" at ");
  const who = role
    ? `${name}, ${role}. Email ${parsed.email ?? "not in the handoff"}. LinkedIn ${parsed.linkedinUrl ?? "not in the handoff"}.`
    : `${name}. Email ${parsed.email ?? "not in the handoff"}. LinkedIn ${parsed.linkedinUrl ?? "not in the handoff"}. Phone ${parsed.phone ?? "not in the handoff"}.`;

  const why =
    parsed.whyTheyReplied ??
    "The handoff does not say why they replied. Treat the call as a first job-search conversation.";

  const overlap = overlapSentence(parsed);
  const topic = topicFrom(parsed);
  return {
    who,
    why,
    overlap,
    questions: [
      topic
        ? `What are you seeing in ${topic} right now?`
        : "What are you seeing in the market for this kind of role right now?",
      "Where does a product-marketing and GTM background like mine actually get hired?",
      "Who else should I talk to about that?",
    ],
    ask: "Two names of people who hire, or who influence hiring, for this kind of role.",
  };
}

export function thankYouDraft(input: {
  name: string | null;
  summary: string;
}): string {
  const fact = firstUsefulSentence(input.summary);
  const middle = fact ?? "I appreciated the time.";
  return `${firstName(input.name)},

Thanks for the call. ${middle}

Jason`;
}

function overlapSentence(parsed: ParsedHandoff): string {
  const blob = `${parsed.whyTheyReplied ?? ""} ${parsed.quotedReply ?? ""}`.toLowerCase();
  if (/commercial|go[- ]to[- ]market|\bgtm\b/.test(blob)) {
    return "They named commercialization or GTM. That sits on the work you did at OUTFRONT and Videri, and on the CMO and CGO search.";
  }
  if (/product marketing|adtech|retail media|\brmn\b/.test(blob)) {
    return "They named product marketing or retail media. That is the OUTFRONT and Videri stretch of your background, and the seat you are searching for.";
  }
  if (/board|private equity|\bpe\b|venture|operating partner/.test(blob)) {
    return "They sit near boards, investors, or operating partners. The useful overlap is hiring judgment, not a product pitch.";
  }
  return "The note does not name a specific overlap. This is a job-search networking call. Ask where your GTM background fits and who else to talk to.";
}

function topicFrom(parsed: ParsedHandoff): string | null {
  const blob = `${parsed.whyTheyReplied ?? ""} ${parsed.availabilityNote ?? ""}`.toLowerCase();
  if (/commercial/.test(blob)) return "commercialization";
  if (/go[- ]to[- ]market|\bgtm\b/.test(blob)) return "go-to-market";
  if (/retail media|\brmn\b/.test(blob)) return "retail media";
  return null;
}

function firstUsefulSentence(summary: string): string | null {
  const sentence = summary
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .find((part) => part.length >= 24 && part.length <= 220);
  return sentence ?? null;
}

export function isCallMorning(startsAt: string, todayYmd: string): boolean {
  return etYmd(startsAt) === todayYmd;
}

export function callHasEnded(endsAt: string | null, startsAt: string, now: Date): boolean {
  const end = Date.parse(endsAt ?? startsAt) + (endsAt ? 0 : 30 * 60_000);
  return Number.isFinite(end) && end < now.getTime();
}
