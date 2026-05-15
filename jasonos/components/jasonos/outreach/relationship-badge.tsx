"use client";

import { cn } from "@/lib/utils";
import {
  RELATIONSHIP_TYPE_LABELS,
  type RelationshipType,
} from "@/lib/outreach/types";

const STYLES: Record<RelationshipType | "unclassified", string> = {
  recruiter: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  hiring_manager: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  operator_peer: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  mentor_advisor: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  prospect: "border-pink-500/40 bg-pink-500/10 text-pink-300",
  personal: "border-blue-500/40 bg-blue-500/10 text-blue-300",
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
