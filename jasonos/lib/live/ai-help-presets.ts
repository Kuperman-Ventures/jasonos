export type AiHelpPresetId = "why" | "rapport" | "what_how" | "tailor";

export type AiHelpPreset = {
  id: AiHelpPresetId;
  label: string;
  instructions: string;
  /** Default mode when the preset is clicked. */
  mode: "add" | "replace";
  /** Extra system guidance for named-slide presets. */
  slideScope: string | null;
  browningFirst: boolean;
};

export const AI_HELP_PRESETS: AiHelpPreset[] = [
  {
    id: "why",
    label: "Fill the Why",
    mode: "add",
    browningFirst: true,
    slideScope:
      "Change only the Why slide. Leave every other slide's headline and bullets untouched.",
    instructions:
      "Using the person context, write the three Why lines on the Why slide in my voice: why this person, why now, and what I want from this call. Keep each under 25 words. Leave a bracket for anything you cannot support from the context.",
  },
  {
    id: "rapport",
    label: "Fill rapport",
    mode: "add",
    browningFirst: true,
    slideScope:
      "Change only the Rapport slide. Leave every other slide's headline and bullets untouched.",
    instructions:
      "Using the person context, write three rapport lines: one specific thing about them, one about their company, one about the referral. Each under 20 words. Nothing generic.",
  },
  {
    id: "what_how",
    label: "Fill What and how",
    mode: "add",
    browningFirst: true,
    slideScope:
      "Change only the What and how slide. Leave every other slide's headline and bullets untouched.",
    instructions:
      "Using the person context, write what I hope to learn, how they can help me, and how I can help them. Each one sentence.",
  },
  {
    id: "tailor",
    label: "Tailor the whole deck",
    mode: "replace",
    browningFirst: false,
    slideScope: null,
    instructions:
      "Rewrite every slide for this person and this meeting using the person context and the meeting context. Keep the order and purpose of each slide.",
  },
];

export function getAiHelpPreset(id: AiHelpPresetId | string | null | undefined): AiHelpPreset | null {
  if (!id) return null;
  return AI_HELP_PRESETS.find((row) => row.id === id) ?? null;
}

export function isBrowningNetPlaybookName(name: string | null | undefined): boolean {
  return Boolean(name?.trim() && /^Net 10/i.test(name.trim()));
}

export function orderedAiHelpPresets(opts: {
  deckName?: string | null;
  sourcePlaybookName?: string | null;
}): AiHelpPreset[] {
  const browning =
    isBrowningNetPlaybookName(opts.deckName) ||
    isBrowningNetPlaybookName(opts.sourcePlaybookName);
  if (!browning) return [...AI_HELP_PRESETS];
  const first = AI_HELP_PRESETS.filter((row) => row.browningFirst);
  const rest = AI_HELP_PRESETS.filter((row) => !row.browningFirst);
  return [...first, ...rest];
}
