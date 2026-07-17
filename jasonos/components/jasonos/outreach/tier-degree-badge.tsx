import { cn } from "@/lib/utils";
import {
  NETWORK_DEGREE_LABELS,
  RELEVANCE_TIER_LABELS,
  type NetworkDegree,
  type RelevanceTier,
} from "@/lib/outreach/types";

/**
 * Combined relevance + closeness code, e.g. "A1", "B3". Relevance tier (A/B/C)
 * first, network degree (1/2/3) second. Returns "" when neither is set (and a
 * partial like "A" or "1" when only one is present).
 */
export function tierDegreeLabel(
  tier: RelevanceTier | null | undefined,
  degree: NetworkDegree | null | undefined
): string {
  return `${tier ?? ""}${degree ?? ""}`;
}

/**
 * A single compact pill showing a contact's relevance + closeness as "A1".
 * Used on the contact card and next to names in collapsed lists. Renders
 * nothing when the contact has neither value set.
 */
export function TierDegreeBadge({
  tier,
  degree,
  className,
}: {
  tier: RelevanceTier | null | undefined;
  degree: NetworkDegree | null | undefined;
  className?: string;
}) {
  const label = tierDegreeLabel(tier, degree);
  if (!label) return null;

  const title =
    [
      tier ? RELEVANCE_TIER_LABELS[tier] : null,
      degree ? NETWORK_DEGREE_LABELS[degree] : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Relevance / closeness";

  const tone =
    tier === "A"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      : tier === "B"
      ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
      : tier === "C"
      ? "border-muted-foreground/30 bg-muted text-muted-foreground"
      : "border-border bg-muted text-muted-foreground";

  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums leading-none",
        tone,
        className
      )}
    >
      {label}
    </span>
  );
}
