// Forwardable intro emails: note to the person you met + fenced block they
// can paste to the intro target.

import { NO_AI_SLOP_WRITING_RULES } from "@/lib/ai/no-ai-slop";

export const INTRO_FORWARD_START = "---------- Forward this ----------";
export const INTRO_FORWARD_END = "---------- End forward ----------";

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

export function extractForwardBlock(body: string): string | null {
  const start = body.indexOf(INTRO_FORWARD_START);
  const end = body.indexOf(INTRO_FORWARD_END);
  if (start < 0 || end < 0 || end <= start) return null;
  return body
    .slice(start + INTRO_FORWARD_START.length, end)
    .replace(/^\s*\n/, "")
    .replace(/\n\s*$/, "")
    .trim();
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

The fenced block is what {meetingContactFirstName} will copy-paste and send as THEIR OWN email to {targetName}. It must read in first person as {meetingContactFirstName} writing to {targetName} — never as Jason writing about himself, and never as a forwarded note from Jason.
${NO_AI_SLOP_WRITING_RULES}

Structure EXACTLY:

Hi {meetingContactFirstName},

{1-2 short sentences thanking them for offering the intro to {targetName}. Put the LinkedIn URL on its own line if provided.}

If you're willing, paste the note below to {targetFirstName} (edit freely) — written as if from you.

${INTRO_FORWARD_START}
Hi {targetFirstName},

{2-4 short sentences in {meetingContactFirstName}'s voice: they are introducing Jason Kuperman; who Jason is (from ABOUT JASON); why the connect makes sense (from RATIONALE); soft ask (from SHORT ASK). Use "I" for the introducer and "Jason" / "he" for Jason — never "I" as Jason.}

{meetingContactFirstName}
${INTRO_FORWARD_END}

Thanks,
Jason

Rules:
- Output the email body only. No subject line. No markdown fences.
- Keep the Forward this / End forward markers exactly as given.
- Inside the markers: first person = {meetingContactFirstName}. Do not sign as Jason. Do not say "Jason asked me to forward" or "see note below from Jason".
- Do not invent facts beyond ABOUT JASON, RATIONALE, SHORT ASK, and TARGET OVERVIEW.
- Direct voice. No exclamation points. No "hope you're well".`;
}

export function introEmailSubject(targetName: string): string {
  const name = targetName.trim() || "intro";
  return `Intro to ${name}`;
}
