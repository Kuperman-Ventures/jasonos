// Local Email Builder draft when the AI model is unavailable.
// Answers are ingredients for prose — never pasted as bare questionnaire lines.

import {
  firstNameFromFullName,
  stripEmDashes,
} from "@/lib/email-templates/render";
import type { BuilderAnswers } from "@/lib/email-builder/model";

export interface FallbackRecipient {
  name: string;
  firm: string | null;
}

function hasGoal(answers: BuilderAnswers, key: string): boolean {
  return answers.goals.includes(key);
}

function primaryGoal(a: BuilderAnswers): string | null {
  const stance = [
    "cold",
    "followup",
    "thanks",
    "congrats",
    "pitch",
    "catchup",
    "reconnect",
  ];
  for (const key of stance) {
    if (hasGoal(a, key)) return key;
  }
  return a.goals[0] ?? null;
}

function note(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function endsWithSentencePunct(s: string): boolean {
  return /[.!?]$/.test(s);
}

function asClause(s: string): string {
  const t = note(s);
  if (!t) return "";
  return endsWithSentencePunct(t) ? t.slice(0, -1) : t;
}

/**
 * Turn a short relationship note into a sentence fragment Jason would write.
 * "Outfront" → "from our OUTFRONT days"
 */
export function relationshipClause(raw: string): string {
  const t = note(raw);
  if (!t) return "";
  const lower = t.toLowerCase();

  if (/^(the\s+)?out\s*-?\s*front$/.test(lower) || lower === "outfront") {
    return "from our OUTFRONT days";
  }
  if (/^(former\s+)?colleagues?(\s+at\s+.+)?$/i.test(t)) {
    return t.toLowerCase().startsWith("former")
      ? t.charAt(0).toLowerCase() + t.slice(1)
      : `former colleagues${t.replace(/^colleagues?/i, "")}`;
  }
  if (t.split(/\s+/).length <= 4 && t.length < 40) {
    if (!/^(at|from|we|i|our)\b/i.test(t)) {
      return `from our ${t} days`;
    }
  }
  const clause = asClause(t);
  return clause.charAt(0).toLowerCase() + clause.slice(1);
}

/**
 * Rewrite a "what to talk about" note into Jason's voice.
 * "They have a new job" → "Saw you landed in a new role..."
 */
export function detailSentence(raw: string, goal: string | null): string {
  const t = note(raw);
  if (!t) return "";
  const lower = t.toLowerCase();

  if (
    /\b(?:they|he|she|you)\s+(?:have|has|got|landed|took|started)\s+(?:a\s+)?new\s+(?:job|role|gig|position)\b/.test(
      lower
    ) ||
    /\bnew\s+(?:job|role|gig|position)\b/.test(lower)
  ) {
    if (goal === "congrats") return "Congrats on the new role.";
    if (goal === "catchup" || goal === "reconnect") {
      return "Saw you landed in a new role and wanted to hear how it's going.";
    }
    return "Curious how the new role is treating you.";
  }

  if (/^(congrats|congratulations)\b/i.test(t)) {
    return endsWithSentencePunct(t) ? t : `${t}.`;
  }

  let rewritten = t
    .replace(/\bThey have\b/gi, "You have")
    .replace(/\bThey've\b/gi, "You've")
    .replace(/\bThey're\b/gi, "You're")
    .replace(/\bTheir\b/gi, "Your")
    .replace(/\bHe has\b/gi, "You have")
    .replace(/\bShe has\b/gi, "You have");

  if (goal === "thanks" && !/^thank/i.test(rewritten)) {
    rewritten = `Thank you for ${asClause(rewritten).replace(/^(for\s+)/i, "")}`;
  } else if (goal === "congrats" && !/^congrat/i.test(rewritten)) {
    rewritten = `Congrats on ${asClause(rewritten).replace(/^(on\s+)/i, "")}`;
  } else if (goal === "followup" && !/follow/i.test(rewritten)) {
    rewritten = `Following up on ${asClause(rewritten).replace(/^(on\s+)/i, "")}`;
  } else if (goal === "pitch" && !/^(i |here's |want)/i.test(rewritten)) {
    rewritten = `I have an idea that may be useful: ${asClause(rewritten)}`;
  }

  if (!endsWithSentencePunct(rewritten)) rewritten = `${rewritten}.`;
  return rewritten.charAt(0).toUpperCase() + rewritten.slice(1);
}

function fallbackAsk(a: BuilderAnswers): string {
  const raw = note(a.ask);
  if (raw) {
    const s = endsWithSentencePunct(raw) ? raw : `${raw}.`;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  if (hasGoal(a, "meeting")) {
    return "If you've got 20-30 minutes in the next few weeks, I'd take it. Happy to work around your schedule.";
  }
  if (hasGoal(a, "advice")) {
    return "I'd value your read on a couple of things. Open to a short call?";
  }
  if (hasGoal(a, "intro")) {
    return "If anyone in your orbit comes to mind, an intro would mean a lot.";
  }
  if (hasGoal(a, "job") || hasGoal(a, "referral")) {
    return "I'm exploring CMO/CGO seats at growth-stage B2B. If you hear of anything, keep me in mind.";
  }
  if (hasGoal(a, "pitch")) {
    return "Happy to send a one-pager or hop on a short call if useful.";
  }
  if (hasGoal(a, "catchup")) {
    return "Would be good to catch up when you have a window.";
  }
  if (hasGoal(a, "reconnect")) {
    return "No agenda beyond reconnecting. Would genuinely enjoy hearing what you're up to.";
  }
  return "";
}

export function fallbackSubject(
  recipient: FallbackRecipient,
  a: BuilderAnswers
): string {
  const firm = recipient.firm || "your team";
  const detail = note(a.detail).toLowerCase();
  if (/\bnew\s+(?:job|role)\b/.test(detail)) {
    if (
      hasGoal(a, "congrats") ||
      hasGoal(a, "catchup") ||
      hasGoal(a, "reconnect")
    ) {
      return "Congrats on the new role";
    }
  }
  switch (primaryGoal(a)) {
    case "cold":
      return "Quick note";
    case "followup":
      return "Following up";
    case "thanks":
      return "Thank you";
    case "congrats":
      return "Congrats";
    case "pitch":
      return `An idea for ${firm}`;
    case "catchup":
      return "Quick check-in";
    case "advice":
      return "Quick ask";
    case "intro":
      return "An intro ask";
    case "job":
    case "referral":
      return "A quick ask";
    case "meeting":
      return "Worth 20 minutes?";
    case "reconnect":
      return "Long overdue";
    default:
      return a.lastSpoke === "never" ? "A quick note" : "Quick note";
  }
}

export function fallbackBody(
  recipient: FallbackRecipient,
  a: BuilderAnswers
): string {
  const first = firstNameFromFullName(recipient.name) || "there";
  const goal = primaryGoal(a);
  const rel = relationshipClause(a.relationship);
  const about = detailSentence(a.detail, goal);
  const ask = fallbackAsk(a);

  const paragraphs: string[] = [];

  if (goal === "thanks") {
    paragraphs.push(about || "Thank you - genuinely appreciated.");
  } else if (goal === "congrats") {
    paragraphs.push(about || "Congrats - well earned.");
  } else if (goal === "followup") {
    const lead = about || "Quick follow-up from our conversation.";
    paragraphs.push(rel ? `${lead} Good to reconnect ${rel}.` : lead);
  } else if (goal === "cold" || a.lastSpoke === "never") {
    const bits = ["We haven't met - I'll keep this short."];
    if (rel) bits.push(`Reached out ${rel}.`);
    if (about) bits.push(about);
    paragraphs.push(bits.join(" "));
  } else if (goal === "pitch") {
    const bits: string[] = [];
    if (rel) bits.push(`We've crossed paths ${rel}.`);
    bits.push(about || "I have a GTM idea that may be useful for your team.");
    paragraphs.push(bits.join(" "));
  } else if (goal === "catchup") {
    const bits: string[] = [];
    if (rel) bits.push(`Wanted to check in ${rel}.`);
    else bits.push("Wanted to check in.");
    if (about) bits.push(about);
    paragraphs.push(bits.join(" "));
  } else if (goal === "reconnect") {
    const opener =
      a.remember <= 2
        ? "This is a name from a while back. Hope it's a welcome one."
        : "It's been too long. You've been on my mind lately.";
    const bits = [opener];
    if (rel) bits.push(`We know each other ${rel}.`);
    else if (a.closeness <= 3) {
      bits.push(
        "We crossed paths earlier in my career and I lost track of too many people I liked working with."
      );
    }
    if (about) bits.push(about);
    paragraphs.push(bits.join(" "));
    if (
      a.length !== "short" &&
      a.remember <= 3 &&
      a.closeness <= 3 &&
      !about
    ) {
      paragraphs.push(
        "Quick version: I spent eight years at OUTFRONT running marketing and product experience through their digital transformation, left last fall, and now do fractional CMO work while figuring out what's next."
      );
    }
  } else {
    const bits: string[] = ["Wanted to send a quick note."];
    if (rel) bits.push(`We know each other ${rel}.`);
    if (about) bits.push(about);
    paragraphs.push(bits.join(" "));
  }

  if (ask && goal !== "thanks" && goal !== "congrats") {
    paragraphs.push(ask);
  } else if (ask && (hasGoal(a, "meeting") || hasGoal(a, "referral"))) {
    paragraphs.push(ask);
  }

  return stripEmDashes(
    [`Hi ${first},`, "", ...paragraphs.flatMap((p, i) => (i === 0 ? [p] : ["", p])), "", "- Jason"]
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

export function buildFallbackDraft(
  recipient: FallbackRecipient,
  answers: BuilderAnswers
): { subject: string; body: string } {
  return {
    subject: stripEmDashes(fallbackSubject(recipient, answers)),
    body: fallbackBody(recipient, answers),
  };
}

/** True when the draft pasted questionnaire notes as bare paragraphs. */
export function looksLikePastedNotes(
  body: string,
  answers: BuilderAnswers
): boolean {
  const lines = body
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const notes = [answers.relationship, answers.detail, answers.ask]
    .map(note)
    .filter((n) => n.length >= 3);

  for (const n of notes) {
    if (lines.some((line) => line.toLowerCase() === n.toLowerCase())) {
      return true;
    }
  }
  return false;
}
