import type { AfterDraft } from "./after";
import type { PlaybookFamily } from "./playbook-blocks";

export interface ThankYouDraft {
  subject: string;
  body: string;
}

export interface ThankYouInput {
  prep: {
    title: string;
    personName: string | null;
    company: string | null;
    /** The role, for Int 101 interviews. */
    role?: string | null;
    family: PlaybookFamily | null;
    /** Points Jason covered, in order. */
    topics: string[];
    /** "How I can help them" from the sheet. */
    helpThem?: string | null;
    referrerName?: string | null;
  };
  afterBlock: {
    /** The After block's thank-you template from the playbook. */
    template: string | null;
    draft: AfterDraft;
  };
  narratives: Array<{ key: string; title: string; body: string }>;
}

export type ThankYouPartKey = "thanks" | "topics" | "actions" | "reminders" | "useful";

export interface ThankYouPart {
  key: ThankYouPartKey;
  label: string;
  text: string;
}

export const THANK_YOU_MAX_WORDS = 150;

const NETWORKING_LABELS: Record<ThankYouPartKey, string> = {
  thanks: "Thank you",
  topics: "Topics",
  actions: "Actions",
  reminders: "Reminders",
  useful: "Something useful",
};

const INTERVIEW_LABELS: Record<ThankYouPartKey, string> = {
  thanks: "Thank you for the interview",
  topics: "What stood out",
  actions: "What I'll send",
  reminders: "Next step",
  useful: "Why I fit",
};

export function isInterview(family: PlaybookFamily | null | undefined): boolean {
  return family === "int101";
}

export function partLabels(family: PlaybookFamily | null | undefined): Record<ThankYouPartKey, string> {
  return isInterview(family) ? INTERVIEW_LABELS : NETWORKING_LABELS;
}

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function firstName(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first || null;
}

function clampWords(text: string, max: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= max) return words.join(" ");
  return `${words.slice(0, max).join(" ").replace(/[,;:]+$/, "")}…`;
}

function lowerFirst(text: string): string {
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

function phrase(text: string): string {
  return lowerFirst(text.trim().replace(/[.?!]+$/, ""));
}

export function joinList(items: string[]): string {
  const rows = items.map((item) => item.trim()).filter(Boolean);
  if (rows.length <= 1) return rows[0] ?? "";
  if (rows.length === 2) return `${rows[0]} and ${rows[1]}`;
  return `${rows.slice(0, -1).join(", ")} and ${rows[rows.length - 1]}`;
}

function sentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return /[.?!…\]]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function easternDay(ymd: string | null): string | null {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function usefulLine(input: ThankYouInput): string {
  const help = input.prep.helpThem?.trim();
  if (help && !/\[[^\]]+\]/.test(help) && !/^(bring|offer|ask|name)\b/i.test(help)) return clampWords(help, 30);
  const contact = input.afterBlock.draft.contactsReceived.find((row) => row.status === "accepted");
  if (contact && !isInterview(input.prep.family)) {
    return `Thank you for pointing me to ${contact.name}. I'll let you know how it goes.`;
  }
  return isInterview(input.prep.family)
    ? "[One line on why my background fits what you described.]"
    : "[Something that helps them: an intro, an article, a name.]";
}

/**
 * The five parts, filled from the After draft without a model. The model draft follows
 * the same order; this is also the fallback when the model fails or runs long.
 */
export function thankYouParts(input: ThankYouInput): ThankYouPart[] {
  const labels = partLabels(input.prep.family);
  const interview = isInterview(input.prep.family);
  const draft = input.afterBlock.draft;
  const company = input.prep.company?.trim() || null;
  const role = input.prep.role?.trim() || null;
  const mine = draft.followUpWith.filter((row) => row.owner === "me").map((row) => phrase(row.text));
  const theirs = draft.followUpWith.filter((row) => row.owner === "them").map((row) => phrase(row.text));
  const topics = input.prep.topics.map(phrase).filter(Boolean).slice(0, 3);
  const nextDay = easternDay(draft.nextContactAt);

  const thanks = interview
    ? `Thank you for the time today${role ? ` to talk about the ${role} role` : ""}${company ? ` at ${company}` : ""}.`
    : input.prep.referrerName
      ? `Thank you for the time today. I'm glad ${input.prep.referrerName} connected us.`
      : "Thank you for the time today.";

  const topicText = topics.length
    ? interview
      ? `I enjoyed hearing about ${joinList(topics)}.`
      : `We covered ${joinList(topics)}.`
    : interview
      ? "I enjoyed hearing about [what stood out]."
      : "We covered [topics].";

  const actionText = mine.length
    ? `I'm going to ${joinList(mine.slice(0, 3))}.`
    : interview
      ? "I'll send [anything I promised] by [date]."
      : "I'm going to [actions].";

  let reminderText: string;
  if (theirs.length) reminderText = `You mentioned you'd ${joinList(theirs.slice(0, 2))}.`;
  else if (nextDay) {
    reminderText = interview
      ? `I look forward to hearing about next steps. I'll check in ${nextDay} if I haven't heard.`
      : `I'll send a calendar invite for ${nextDay}.`;
  } else {
    reminderText = interview ? "I look forward to hearing about next steps." : "You mentioned you'd [reminder].";
  }

  const parts: ThankYouPart[] = [
    { key: "thanks", label: labels.thanks, text: thanks },
    { key: "topics", label: labels.topics, text: clampWords(topicText, 30) },
    { key: "actions", label: labels.actions, text: clampWords(actionText, 30) },
    { key: "reminders", label: labels.reminders, text: clampWords(reminderText, 25) },
    { key: "useful", label: labels.useful, text: sentence(usefulLine(input)) },
  ];
  return interview
    ? [parts[0], parts[1], parts[4], parts[2], parts[3]]
    : parts;
}

export function thankYouSubject(input: ThankYouInput): string {
  const first = firstName(input.prep.personName);
  if (isInterview(input.prep.family)) {
    const role = input.prep.role?.trim();
    return role ? `Thank you, ${role} conversation` : first ? `Thank you, ${first}` : "Thank you for today";
  }
  return first ? `Thank you, ${first}` : "Thank you for today";
}

/** Deterministic draft: greeting, the five parts as short paragraphs, sign-off. Under 150 words. */
export function composeThankYou(input: ThankYouInput): ThankYouDraft {
  const first = firstName(input.prep.personName);
  const parts = thankYouParts(input);
  const paragraphs = [
    parts[0].text,
    `${parts[1].text} ${parts[2].text}`,
    `${parts[3].text} ${parts[4].text}`,
  ];
  let body = [first ? `${first},` : "Hi,", ...paragraphs, "Jason"].join("\n\n");
  if (wordCount(body) > THANK_YOU_MAX_WORDS) body = clampWords(body, THANK_YOU_MAX_WORDS);
  return { subject: thankYouSubject(input), body };
}

export function thankYouSystemPrompt(writingRules: string, family: PlaybookFamily | null): string {
  const labels = partLabels(family);
  const order = thankYouParts({
    prep: { title: "", personName: null, company: null, family, topics: [] },
    afterBlock: { template: null, draft: { conversation: "", contactsReceived: [], followUpWith: [], nextContactAt: null, toDiscussNext: "" } },
    narratives: [],
  }).map((part) => labels[part.key]);
  const kind = isInterview(family)
    ? "an interview thank-you note, sent within 24 hours of the interview"
    : "a networking thank-you note, sent within 24 hours of the call";
  return `Write ${kind} from Jason. Return JSON only: {"subject":"...","body":"..."}
Structure, in this order, one or two sentences each: ${order.map((label, index) => `${index + 1}. ${label}`).join("; ")}.
Rules:
- Under ${THANK_YOU_MAX_WORDS} words in the body, including the greeting and "Jason" sign-off.
- Open with their first name and a comma. Sign off with "Jason" on its own line. No "Best," or "Warmly,".
- Use only facts from the call log and sheet. Name the real topics, actions and reminders.
- Actions are what Jason promised. Reminders are what they promised, or the next date.
- When a part has nothing to go on, write a [square bracket] placeholder Jason fills by hand.
- Subject under 8 words. Plain text body, short paragraphs, no bullets.
${writingRules}`;
}

export function buildThankYouMessage(input: ThankYouInput): string {
  const draft = input.afterBlock.draft;
  const rows = [
    `Person: ${input.prep.personName ?? "Unknown"}${input.prep.company ? `, ${input.prep.company}` : ""}`,
    `Meeting: ${input.prep.title}`,
    input.prep.role ? `Role: ${input.prep.role}` : null,
    input.prep.referrerName ? `Introduced by: ${input.prep.referrerName}` : null,
    input.prep.topics.length ? `Covered: ${input.prep.topics.join("; ")}` : "Covered: none marked",
    draft.conversation.trim() ? `What they said:\n${draft.conversation.trim()}` : null,
    draft.followUpWith.length
      ? `Follow-ups:\n${draft.followUpWith.map((row) => `- ${row.owner === "me" ? "Jason" : "Them"}: ${row.text}`).join("\n")}`
      : "Follow-ups: none",
    draft.contactsReceived.some((row) => row.status === "accepted")
      ? `People they pointed Jason to: ${draft.contactsReceived
          .filter((row) => row.status === "accepted")
          .map((row) => row.name)
          .join(", ")}`
      : null,
    draft.nextContactAt ? `Next contact: ${draft.nextContactAt}` : null,
    input.prep.helpThem?.trim() ? `How Jason can help them: ${input.prep.helpThem.trim()}` : null,
    input.afterBlock.template?.trim() ? `Playbook template: ${input.afterBlock.template.trim()}` : null,
    ...input.narratives
      .filter((item) => item.body.trim())
      .slice(0, 3)
      .map((item) => `About Jason (${item.title}): ${clampWords(item.body, 120)}`),
  ];
  return rows.filter(Boolean).join("\n\n");
}

function unwrapJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

export function parseThankYou(text: string): ThankYouDraft | null {
  try {
    const parsed = JSON.parse(unwrapJson(text)) as Record<string, unknown>;
    const subject = typeof parsed.subject === "string" ? parsed.subject.trim().replace(/\s+/g, " ") : "";
    const body = typeof parsed.body === "string" ? parsed.body.replace(/\r\n/g, "\n").trim() : "";
    if (!subject || !body) return null;
    return { subject: subject.slice(0, 160), body };
  } catch {
    return null;
  }
}

export type ThankYouGenerate = (input: { system: string; message: string }) => Promise<string>;

/**
 * Five-part thank-you in Jason's voice. With `generate` the model writes it; a model draft
 * that fails to parse or runs past 150 words falls back to the template draft.
 */
export async function draftThankYou(
  input: ThankYouInput,
  options: { generate?: ThankYouGenerate; writingRules?: string } = {}
): Promise<ThankYouDraft & { drafted: "model" | "template"; warning: string | null }> {
  const fallback = composeThankYou(input);
  if (!options.generate) return { ...fallback, drafted: "template", warning: null };
  try {
    const text = await options.generate({
      system: thankYouSystemPrompt(options.writingRules ?? "", input.prep.family),
      message: buildThankYouMessage(input),
    });
    const parsed = parseThankYou(text);
    if (!parsed) return { ...fallback, drafted: "template", warning: "Could not read the drafted note." };
    if (wordCount(parsed.body) > THANK_YOU_MAX_WORDS) {
      return { ...fallback, drafted: "template", warning: "The drafted note ran past 150 words." };
    }
    return { ...parsed, drafted: "model", warning: null };
  } catch (err) {
    return {
      ...fallback,
      drafted: "template",
      warning: err instanceof Error ? err.message : "Could not draft the note.",
    };
  }
}

/** meeting_preps.thank_you_draft holds "Subject: …" then a blank line, then the body. */
export function formatStoredThankYou(draft: ThankYouDraft): string {
  return `Subject: ${draft.subject.trim()}\n\n${draft.body.trim()}`;
}

export function parseStoredThankYou(text: string | null | undefined): ThankYouDraft | null {
  const value = text?.replace(/\r\n/g, "\n").trim();
  if (!value) return null;
  const match = value.match(/^Subject:\s*(.*)\n\n?([\s\S]*)$/);
  if (match) return { subject: match[1].trim(), body: match[2].trim() };
  return { subject: "", body: value };
}

export function mailtoHref(input: { to: string | null; subject: string; body: string }): string {
  const params = [`subject=${encodeURIComponent(input.subject)}`, `body=${encodeURIComponent(input.body)}`];
  return `mailto:${input.to ? encodeURIComponent(input.to) : ""}?${params.join("&")}`;
}
