import type { Likelihood } from "@/lib/dashboard/schema";
import styles from "./dashboard.module.css";

const LABEL: Record<Likelihood, string> = {
  high: "High likelihood",
  medium: "Medium likelihood",
  low: "Low likelihood",
};

export const LIKELIHOOD_TONE: Record<Likelihood, { fg: string; bg: string }> = {
  high: { fg: "oklch(0.42 0.12 150)", bg: "oklch(0.95 0.04 150)" },
  medium: { fg: "oklch(0.45 0.11 70)", bg: "oklch(0.96 0.06 85)" },
  low: { fg: "oklch(0.45 0.18 27)", bg: "oklch(0.95 0.04 27)" },
};

export function LikelihoodPill({ likelihood }: { likelihood: Likelihood }) {
  const tone = LIKELIHOOD_TONE[likelihood];
  return (
    <span className={styles.pill} style={{ color: tone.fg, background: tone.bg, borderColor: tone.fg }}>
      <span className={styles.pillBullet} />
      {LABEL[likelihood]}
    </span>
  );
}
