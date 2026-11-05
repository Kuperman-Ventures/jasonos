import type { Likelihood } from "@/lib/dashboard/schema";
import styles from "./dashboard.module.css";

const LABEL: Record<Likelihood, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function LikelihoodPill({ likelihood }: { likelihood: Likelihood }) {
  return (
    <span className={styles.pill} data-likelihood={likelihood}>
      {LABEL[likelihood]}
    </span>
  );
}
