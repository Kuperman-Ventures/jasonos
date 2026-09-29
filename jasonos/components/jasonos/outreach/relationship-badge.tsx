"use client";

import { cn } from "@/lib/utils";
import {
  RELATIONSHIP_TYPE_LABELS,
  type RelationshipType,
} from "@/lib/outreach/types";

const STYLES: Record<RelationshipType | "unclassified", string> = {
  recruiter: "border-[var(--jos-line)] bg-rung-2 ",
  hiring_manager: "border-rung-3 bg-rung-3 ",
  operator_peer: "border-[var(--jos-line)] bg-rung-4 ",
  mentor_advisor: "border-[var(--jos-line)] bg-rung-idle ",
  prospect: "border-pink-500/40 bg-pink-500/10 text-pink-300",
  personal: "border-rung-3 bg-rung-3 ",
  unclassified: "border-border bg-muted/40 text-muted-foreground",
};

export function RelationshipBadge({
  type,
  className,
}: {
  type: RelationshipType | null | undefined;
  className?: string;
}) {
  const key = type ?? "unclassified";
  const label = type ? RELATIONSHIP_TYPE_LABELS[type] : "Unclassified";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
        STYLES[key],
        className
      )}
    >
      {label}
    </span>
  );
}
