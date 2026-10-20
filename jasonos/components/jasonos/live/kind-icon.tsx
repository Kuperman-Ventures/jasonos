import {
  ChatCircleText,
  ListBullets,
  Question,
  Target,
  type Icon,
} from "@phosphor-icons/react";
import type { PointKind } from "@/lib/meeting-prep/points";
import { cn } from "@/lib/utils";
import { LIVE_KIND } from "./tokens";

const ICONS: Record<PointKind, Icon> = {
  agenda: ListBullets,
  point: ChatCircleText,
  question: Question,
  ask: Target,
};

export function KindIcon({
  kind,
  size = 18,
  className,
  weight = "duotone",
}: {
  kind: PointKind;
  size?: number;
  className?: string;
  weight?: "duotone" | "regular" | "bold" | "fill";
}) {
  const Icon = ICONS[kind];
  const meta = LIVE_KIND[kind];
  return (
    <Icon
      size={size}
      weight={weight}
      className={cn("shrink-0", className)}
      style={{ color: meta.iconColor }}
      aria-hidden
    />
  );
}

export function KindLabel({
  kind,
  className,
}: {
  kind: PointKind;
  className?: string;
}) {
  const meta = LIVE_KIND[kind];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-[0.14em]",
        className
      )}
      style={{ color: meta.text }}
    >
      <KindIcon kind={kind} size={16} />
      {meta.label}
    </span>
  );
}
