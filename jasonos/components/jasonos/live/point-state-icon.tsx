import {
  ArrowCircleRight,
  CheckCircle,
  type Icon,
} from "@phosphor-icons/react";
import type { PointKind, PointState } from "@/lib/meeting-prep/points";
import { cn } from "@/lib/utils";
import { KindIcon } from "./kind-icon";
import { railStateFor, type LiveRailState } from "./tokens";

export function PointStateIcon({
  kind,
  state,
  current,
  size = 18,
  className,
}: {
  kind: PointKind;
  state: PointState;
  current?: boolean;
  size?: number;
  className?: string;
}) {
  const rail = railStateFor({ state }, Boolean(current));
  if (rail === "done") {
    return (
      <CheckCircle
        size={size}
        weight="duotone"
        className={cn("shrink-0 text-[var(--color-done)]", className)}
        style={{ color: "#006925" }}
        aria-hidden
      />
    );
  }
  if (rail === "current") {
    return (
      <ArrowCircleRight
        size={size}
        weight="duotone"
        className={cn("shrink-0 text-[var(--jos-ink)]", className)}
        aria-hidden
      />
    );
  }
  if (rail === "skipped") {
    return (
      <CheckCircle
        size={size}
        weight="regular"
        className={cn("shrink-0 text-[var(--jos-muted)] opacity-50", className)}
        aria-hidden
      />
    );
  }
  return <KindIcon kind={kind} size={size} className={className} />;
}

export function railRowClass(rail: LiveRailState): string {
  if (rail === "current") {
    return "border-l-4 border-[var(--color-accent-2)] bg-[var(--jos-surface)] font-bold";
  }
  if (rail === "done") {
    return "border-l-4 border-transparent text-[var(--jos-muted)]";
  }
  if (rail === "skipped") {
    return "border-l-4 border-transparent text-[var(--jos-muted)]";
  }
  return "border-l-4 border-transparent";
}

export type { Icon };
