// Intro emails: short note to the person you met + dashed block they paste
// to the intro target (in their voice).

import { NO_AI_SLOP_WRITING_RULES } from "@/lib/ai/no-ai-slop";

/** Dashed fence around the paste-ready intro note. */
export const INTRO_FORWARD_START = "--------------------";
export const INTRO_FORWARD_END = "--------------------";

/** Legacy markers from earlier drafts (still extractable). */
const LEGACY_FORWARD_START = "---------- Forward this ----------";
const LEGACY_FORWARD_END = "---------- End forward ----------";

export type IntroWishFields = {
  name: string;
  company: string;
  linkedinUrl: string;
  rationale: string;
  agreed?: boolean;
  targetOverview?: string;
  introDraft?: string;
  introDraftAt?: string;
};

export function normalizeIntroWish(raw: unknown): IntroWishFields | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const company = typeof o.company === "string" ? o.company.trim() : "";
  const linkedinUrl =
    typeof o.linkedinUrl === "string"
      ? o.linkedinUrl.trim()
      : typeof o.linkedin_url === "string"
        ? o.linkedin_url.trim()
        : "";
  const rationale = typeof o.rationale === "string" ? o.rationale.trim() : "";
  if (!name && !company && !linkedinUrl && !rationale) return null;
  return {
    name,
    company,
    linkedinUrl,
    rationale,
    agreed: o.agreed === true,
    targetOverview:
      typeof o.targetOverview === "string" ? o.targetOverview.trim() : undefined,
    introDraft: typeof o.introDraft === "string" ? o.introDraft : undefined,
    introDraftAt: typeof o.introDraftAt === "string" ? o.introDraftAt : undefined,
  };
}

export function serializeIntroWishlist(items: IntroWishFields[]): IntroWishFields[] {
  return items
    .map((w) => ({
      name: (w.name ?? "").trim(),
      company: (w.company ?? "").trim(),
      linkedinUrl: (w.linkedinUrl ?? "").trim(),
      rationale: (w.rationale ?? "").trim(),
      ...(w.agreed ? { agreed: true } : {}),
      ...(w.targetOverview?.trim()
        ? { targetOverview: w.targetOverview.trim() }
        : {}),
      ...(w.introDraft?.trim() ? { introDraft: w.introDraft } : {}),
      ...(w.introDraftAt ? { introDraftAt: w.introDraftAt } : {}),
    }))
    .filter((w) => w.name || w.company || w.linkedinUrl || w.rationale);
}

function sliceBetween(
  body: string,
  startMarker: string,
  endMarker: string
): string | null {
  const start = body.indexOf(startMarker);
  if (start < 0) return null;
  const afterStart = start + startMarker.length;
  const end = body.indexOf(endMarker, afterStart);
  if (end < 0) return null;
  return body
    .slice(afterStart, end)
    .replace(/^\s*\n/, "")
    .replace(/\n\s*$/, "")
    .trim();
}

export function extractForwardBlock(body: string): string | null {
  return (
    sliceBetween(body, INTRO_FORWARD_START, INTRO_FORWARD_END) ??
    sliceBetween(body, LEGACY_FORWARD_START, LEGACY_FORWARD_END)
  );
}

export function introMailtoUrl(input: {
  to: string;
  subject: string;
  body: string;
}): string {
  // encodeURIComponent → %20 for spaces. URLSearchParams uses +, which Apple
  // Mail often pastes literally into the compose body.
  const to = input.to.trim();
  return `mailto:${to}?subject=${encodeURIComponent(input.subject)}&body=${encodeURIComponent(input.body)}`;
}

export function rationaleSystemPrompt(): string {
  return `You write a 1-2 sentence rationale for why Jason Kuperman should connect with someone.
${NO_AI_SLOP_WRITING_RULES}

Rules:
- Output ONLY the rationale sentences. No subject, no greeting, no quotes around the whole thing.
- 1-2 sentences max.
- Use only facts from ABOUT JASON and TARGET OVERVIEW. Do not invent mutual history, shared employers, or stats.
- Direct operator voice. No exclamation points. No "excited to connect" fluff.
- Name the concrete overlap (industry, role, problem, network) when the overview supports it.`;
}

export function introEmailSystemPrompt(): string {
  return `You draft an email Jason sends to someone he just met ({meetingContactFirstName}), asking them to intro him to a third person ({targetName}).

Between the dashed lines is what {meetingContactFirstName} will copy-paste and send as THEIR OWN email to {targetName}. It must read in first person as {meetingContactFirstName} writing to {targetName} — never as Jason writing about himself.
${NO_AI_SLOP_WRITING_RULES}

Structure EXACTLY (match this shape and tone — keep it short):

Hi {meetingContactFirstName},

Thanks for offering to intro me to {targetFirstName}. {His/Her/Their} profile is here:
{linkedinUrl}

${INTRO_FORWARD_START}
Hi {targetFirstName},

{2-3 sentences in {meetingContactFirstName}'s voice introducing Jason Kuperman: who he is (from ABOUT JASON, compressed), why the connect makes sense (from RATIONALE), soft ask for a Zoom to compare notes (from SHORT ASK). Use "I" for the introducer and "Jason" / "he" for Jason — never "I" as Jason. End the ask as a question when natural.}

{meetingContactFirstName}
${INTRO_FORWARD_END}

Thanks,
Jason

Rules:
- Output the email body only. No subject line. No markdown fences.
- Use exactly twenty hyphens (${INTRO_FORWARD_START}) as the open and close fence — nothing else on those lines (no "Forward this" labels).
- Outer note: one short thanks line + LinkedIn URL on its own line. No "paste the note below" instruction.
- Inside the dashes: first person = {meetingContactFirstName}. Sign with their first name only. Do not sign as Jason.
- Do not invent facts beyond ABOUT JASON, RATIONALE, SHORT ASK, and TARGET OVERVIEW.
- Direct voice. No exclamation points. No "hope you're well".`;
}

export function introEmailSubject(targetName: string): string {
  const name = targetName.trim() || "intro";
  return `Intro to ${name}`;
}
