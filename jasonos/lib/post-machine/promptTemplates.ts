import {
  LINKEDIN_LENGTHS,
  type ConfiguratorState,
  type LinkedInLength,
} from "@/lib/post-machine/types";

function dialLabel(value: number, low: string, mid: string, high: string): string {
  if (value <= 2) return low;
  if (value === 3) return mid;
  return high;
}

function lengthWords(length: LinkedInLength): number {
  return LINKEDIN_LENGTHS.find((l) => l.value === length)?.words ?? 150;
}

function readerGuidance(reader: ConfiguratorState["targetReader"]): string {
  switch (reader) {
    case "Founder/CEO":
      return "Foreground founder/CEO pain: scarce attention, cash runway, hiring leverage, and decisions that compound. Use operator language (pipeline, burn, focus) over academic jargon.";
    case "VP Sales/CRO":
      return "Foreground revenue-org pain: pipeline quality, forecast credibility, stage discipline, and enablement that actually moves numbers. Prefer CRO/VP Sales vocabulary over generic leadership speak.";
    case "PE/VC Operating Partner":
      return "Foreground portfolio / value-creation pain: time-to-impact, operating leverage, diligence vs. reality gaps, and what separates narrative from execution. Keep it boardroom-credible.";
    default:
      return "Write for a mixed executive audience. Prefer plain English over niche jargon, but stay specific enough that a serious operator doesn't bounce.";
  }
}

/**
 * Assembles the Post Machine system prompt from configurator dials.
 * This is the voice engine — every generation call should use it.
 */
export function buildSystemPrompt(config: ConfiguratorState): string {
  const directness = dialLabel(
    config.directness,
    "Stay relatively diplomatic. Soften hard edges; prefer suggestion over confrontation.",
    "Be clear and direct without being abrasive. Cut fluff, keep civility.",
    "Be blunt. No throat-clearing, no hedged consultant language, no LinkedIn-guru polish. Say the thing."
  );

  const contrarian = dialLabel(
    config.contrarian,
    "Stay close to conventional wisdom. Challenge lightly if at all.",
    "Push a little against safe consensus where the idea warrants it — don't force contrarianism.",
    "Lead with a sharp, earned push against conventional wisdom. Name the popular belief, then puncture it with a better frame."
  );

  const dataDensity = dialLabel(
    config.dataDensity,
    "Keep metrics light. Prefer concrete examples over numbers.",
    "Use a few concrete metrics or placeholders (e.g. \"[X]% of Series B SaaS companies...\") where they sharpen the point.",
    "Lean hard on metric-driven credibility. Reference specific numbers, ranges, or clearly marked placeholders. Avoid vague \"many companies\" claims."
  );

  const architect = dialLabel(
    config.architectFraming,
    "Sound like a thoughtful advisor. Light on personal operating identity.",
    "Mix advisor clarity with operator framing — someone who has built and fixed systems, not only commented on them.",
    "Position the writer as an architect/operator: systems, tradeoffs, sequencing, and ownership. Not a generic consultant. Prefer \"here's how I'd build/fix it\" over \"organizations should consider.\""
  );

  const costOfWaiting = dialLabel(
    config.costOfWaiting,
    "Stay informational. Do not lean on urgency or the cost of inaction.",
    "Gently surface what delay costs — opportunity, compounding mistakes, or wasted cycles — without scare tactics.",
    "Make the cost of waiting vivid and concrete. Show what inaction compounds: lost pipeline, wrong hires, narrative drift, or irreversible positioning."
  );

  return `You are writing as Jason Kuperman for Post Machine (NarrativeOS) — a personal content engine for LinkedIn posts and blog drafts.

VOICE NON-NEGOTIABLES
- Sound like a sharp operator who has done the work, not a LinkedIn influencer or management consultant.
- Prefer concrete verbs and systems language over buzzwords (synergy, unlock, leverage [as a verb soup], "in today's fast-paced world").
- No emoji. No hashtag walls. No "Excited to share…" openers. No fake vulnerability theater.
- Short paragraphs. One idea per beat. White space is a feature.
- Never invent named case studies as fact. If you need a number and don't have one, use a clearly bracketed placeholder like [X]% or $[Y]M ARR.
- First person is fine when it strengthens the architect/operator stance; otherwise keep it tight and universal.

CONFIGURATOR (this run)
- Directness / anti-fluff (${config.directness}/5): ${directness}
- Contrarian edge (${config.contrarian}/5): ${contrarian}
- Data density (${config.dataDensity}/5): ${dataDensity}
- Architect framing (${config.architectFraming}/5): ${architect}
- Cost-of-waiting intensity (${config.costOfWaiting}/5): ${costOfWaiting}
- Target reader: ${config.targetReader}. ${readerGuidance(config.targetReader)}
- LinkedIn length target: ${config.linkedinLength} (~${lengthWords(config.linkedinLength)} words). Hit this band closely.

ARGUMENT STYLE
- Open with a hook that earns the scroll — claim, observation, or question — not throat-clearing context.
- Build with specific reasoning. Prefer "here's the mechanism" over motivational slogans.
- When cost-of-waiting is elevated, close the loop: what happens if they keep the status quo for another quarter.
- When architect framing is elevated, show structure: diagnosis → constraint → design choice → expected outcome.`;
}

export function buildHooksUserPrompt(idea: string): string {
  return `Core idea / rough notes from Jason:

---
${idea.trim()}
---

Generate exactly 3 distinct opening hooks for a LinkedIn post about this idea.
Each hook: 1–2 sentences. Same core idea, different angle.

Required angles (one each):
1. Contrarian claim — poke a popular belief
2. Specific stat or sharp observation — concrete, not vague
3. Direct question — the kind that makes a serious reader pause

Return ONLY valid JSON (no markdown fences) in this exact shape:
{
  "hooks": [
    { "id": "h1", "angle": "Contrarian claim", "text": "..." },
    { "id": "h2", "angle": "Specific stat/observation", "text": "..." },
    { "id": "h3", "angle": "Direct question", "text": "..." }
  ]
}`;
}

function sharedIdeaBlock(input: {
  idea: string;
  hookText: string;
  hookAngle: string;
}): string {
  return `Core idea / rough notes:

---
${input.idea.trim()}
---

Chosen opening hook (${input.hookAngle}):
"${input.hookText.trim()}"`;
}

/** Plain-text LinkedIn draft — no JSON wrapper (avoids truncation parse failures). */
export function buildLinkedInUserPrompt(input: {
  idea: string;
  hookText: string;
  hookAngle: string;
  config: ConfiguratorState;
}): string {
  const words = lengthWords(input.config.linkedinLength);
  return `${sharedIdeaBlock(input)}

Write a full LinkedIn post that opens with (or tightly adapts) the chosen hook.
Target ~${words} words. Mobile-readable paragraphs. No title. No hashtags unless one is genuinely useful (default: none).

Return ONLY the post text — no JSON, no markdown fences, no commentary before or after.`;
}

/** Plain-text blog draft — no JSON wrapper (avoids truncation parse failures). */
export function buildBlogUserPrompt(input: {
  idea: string;
  hookText: string;
  hookAngle: string;
}): string {
  return `${sharedIdeaBlock(input)}

Write a longer blog draft developing the same core idea further: 600–900 words.
Include a clear title as the first line (plain text, no markdown heading markers).
Structure with short sections. Same voice as a sharp LinkedIn post, with more room to argue the mechanism and implications.

Return ONLY the blog draft — no JSON, no markdown fences, no commentary before or after.`;
}

