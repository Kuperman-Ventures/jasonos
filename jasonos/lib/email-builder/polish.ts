// Post-process Email Builder drafts so questionnaire notes stay facts,
// not pasted sentences with leftover form capitalization ("because We").

import type { BuilderAnswers } from "./model";

function folded(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function note(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function freeTextNotes(answers: BuilderAnswers): string[] {
  return [answers.relationship, answers.detail, answers.ask]
    .map(note)
    .filter((n) => n.length >= 3);
}

/**
 * True when the draft copied a long questionnaire note almost word-for-word.
 * Short facts ("Chiat/Day", "OUTFRONT") are allowed to appear.
 */
export function looksLikePastedNotes(
  body: string,
  answers: BuilderAnswers
): boolean {
  const lines = body
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const bodyFold = folded(body);

  for (const n of freeTextNotes(answers)) {
    const nf = folded(n);
    const wordCount = nf.split(/\s+/).filter(Boolean).length;
    if (
      (wordCount >= 8 || nf.length >= 50) &&
      nf.length > 0 &&
      bodyFold.includes(nf)
    ) {
      return true;
    }
    if (lines.some((line) => folded(line) === nf)) {
      return true;
    }
  }
  return false;
}

const MID_SENTENCE_HOOK =
  /\b(because|and|as|since|while|after|before|when|where|that|which|but|if|including)\s+(We|They|He|She|Our|My)\b/g;

/**
 * Form notes often start with "We…". Spliced mid-sentence that capital is
 * leftover from the questionnaire, not English.
 */
export function fixMidSentencePronounCaps(body: string): string {
  return body.replace(MID_SENTENCE_HOOK, (_all, hook: string, pro: string) => {
    return `${hook} ${pro.toLowerCase()}`;
  });
}

/** Drop filler the prompt already bans but the model still sneaks in. */
export function stripBannedGreetings(body: string): string {
  return body
    .replace(/\bhope this finds you well\.?\s*/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export function polishBuilderDraft(draft: {
  subject: string;
  body: string;
}): { subject: string; body: string } {
  return {
    subject: draft.subject.trim(),
    body: stripBannedGreetings(fixMidSentencePronounCaps(draft.body)),
  };
}
