"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { focusBadgeText, focusLabel } from "@/lib/reconnect/firm-focus";

const STYLE_MAP: Record<string, string> = {
  anchor:    "bg-rung-1  border-rung-1 font-semibold tracking-wide",
  secondary: "bg-rung-2  border-[var(--jos-line)]",
  tertiary:  "bg-rung-2  border-[var(--jos-line)]",
  bench:     "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

const TOOLTIP_MAP: Record<string, string> = {
  anchor:    "Anchor — your primary contact at this firm. All firm activity routes through here.",
  secondary: "Secondary — bench depth. Don't reach independently; let the anchor loop them in.",
  tertiary:  "Tertiary — bench depth. Don't reach independently.",
  bench:     "Bench — do not reach independently. Search firms log all touches in shared CRMs (Invenias, Clockwork, Thrive) and duplicate outreach reads as uncoordinated.",
};

export function FocusBadge({ rank }: { rank: number | null | undefined }) {
  const label = focusLabel(rank);
  const text = focusBadgeText(rank);
  if (!label || !text) return null;

  return (
    <Tooltip>
      <TooltipTrigger className="cursor-default">
        <Badge variant="outline" className={`text-[10px] uppercase ${STYLE_MAP[label]}`}>
          {text}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">
        {TOOLTIP_MAP[label]}
      </TooltipContent>
    </Tooltip>
  );
}
