import type { Likelihood } from "@/lib/projects/oversight-agenda/data";

const LABEL: Record<Likelihood, string> = {
  high: "High likelihood",
  medium: "Medium likelihood",
  low: "Low likelihood",
};

/** Green, amber, and red from the dashboard artifact. Not the cyan accent. */
const TONE: Record<Likelihood, { fg: string; bg: string }> = {
  high: { fg: "oklch(0.42 0.12 150)", bg: "oklch(0.95 0.04 150)" },
  medium: { fg: "oklch(0.45 0.11 70)", bg: "oklch(0.96 0.06 85)" },
  low: { fg: "oklch(0.45 0.18 27)", bg: "oklch(0.95 0.04 27)" },
};

export function likelihoodTone(likelihood: Likelihood) {
  return TONE[likelihood];
}

export function LikelihoodPill({ likelihood }: { likelihood: Likelihood }) {
  const tone = TONE[likelihood];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-2 border-2 px-3 py-1.5 text-[13px] font-bold"
      style={{ borderColor: tone.fg, color: tone.fg, background: tone.bg }}
    >
      <span className="h-2 w-2 shrink-0" style={{ background: tone.fg }} />
      {LABEL[likelihood]}
    </span>
  );
}
