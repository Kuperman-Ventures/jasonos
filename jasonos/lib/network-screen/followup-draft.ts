/** Parse and fall back for Network Screen pending-intro follow-up drafts. */

export type IntroFollowupDraftInput = {
  name: string;
  firstName: string;
  connectorName: string;
  title: string | null;
  company: string | null;
  why: string | null;
  ask: string | null;
  lane: string | null;
};

export type IntroFollowupDraft = {
  subject: string;
  body: string;
  source: "ai" | "fallback";
};

function trim(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function stripCodeFence(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/** Best-effort repair when the model puts raw newlines inside JSON string values. */
function repairLooseJson(text: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        out += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        out += ch;
        inString = false;
        continue;
      }
      if (ch === "\n") {
        out += "\\n";
        continue;
      }
      if (ch === "\r") continue;
      if (ch === "\t") {
        out += "\\t";
        continue;
      }
      out += ch;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    out += ch;
  }
  return out;
}

function fromJsonText(text: string): { subject: string; body: string } | null {
  const cleaned = stripCodeFence(text);
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  for (const candidate of [match[0], repairLooseJson(match[0])]) {
    try {
      const parsed = JSON.parse(candidate) as { subject?: unknown; body?: unknown };
      const subject = typeof parsed.subject === "string" ? parsed.subject.trim() : "";
      const body = typeof parsed.body === "string" ? parsed.body.trim() : "";
      if (!body) continue;
      return { subject, body };
    } catch {
      // try next shape
    }
  }
  return null;
}

function fromPlainEmail(text: string): { subject: string; body: string } | null {
  const cleaned = stripCodeFence(text).trim();
  if (!cleaned || cleaned.startsWith("{")) return null;
  const lines = cleaned.split(/\r?\n/);
  let subject = "";
  let start = 0;
  if (/^subject\s*:/i.test(lines[0] ?? "")) {
    subject = (lines[0] ?? "").replace(/^subject\s*:/i, "").trim();
    start = 1;
    while (start < lines.length && !(lines[start] ?? "").trim()) start += 1;
  }
  const body = lines.slice(start).join("\n").trim();
  if (!body || body.length < 40) return null;
  if (!/^hi\b|^hello\b/i.test(body) && !/jason\s*$/i.test(body)) return null;
  return { subject, body };
}

export function parseIntroFollowupDraft(text: string): { subject: string; body: string } | null {
  return fromJsonText(text) ?? fromPlainEmail(text);
}

export function buildFallbackIntroFollowup(input: IntroFollowupDraftInput): IntroFollowupDraft {
  const first = trim(input.firstName) || "there";
  const connector = trim(input.connectorName) || "a mutual connection";
  const why = trim(input.why);
  const titleCompany = [trim(input.title), trim(input.company)].filter(Boolean).join(" at ");
  const lane = trim(input.lane);
  const roleLine =
    lane === "advisors"
      ? "I help B2B tech companies tighten GTM when sales and marketing are out of sync."
      : "I am looking at CMO and SVP Marketing seats in B2B tech.";

  const whyLine = why
    ? why.replace(/\bJason\b/g, "I").replace(/\bjason\b/g, "I")
    : titleCompany
      ? `Your work as ${titleCompany} is exactly the conversation I want right now.`
      : "I want a short conversation about where you are focused.";

  const body = [
    `Hi ${first},`,
    "",
    `Thanks for connecting - ${connector} made the introduction.`,
    "",
    `${roleLine} ${whyLine}`,
    "",
    "Open to 20 minutes this week or next?",
    "",
    "- Jason",
  ].join("\n");

  return {
    subject: `Thanks for the intro from ${connector}`,
    body,
    source: "fallback",
  };
}

export function polishIntroFollowupDraft(
  draft: { subject: string; body: string },
  input: IntroFollowupDraftInput,
  source: "ai" | "fallback"
): IntroFollowupDraft {
  const subject =
    trim(draft.subject) || `Thanks for the intro from ${trim(input.connectorName) || "a mutual connection"}`;
  const body = trim(draft.body)
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
  return { subject, body, source };
}

export function resolveIntroFollowupDraft(
  modelText: string | null | undefined,
  input: IntroFollowupDraftInput
): IntroFollowupDraft {
  const parsed = modelText ? parseIntroFollowupDraft(modelText) : null;
  if (parsed?.body) {
    return polishIntroFollowupDraft(parsed, input, "ai");
  }
  return buildFallbackIntroFollowup(input);
}
