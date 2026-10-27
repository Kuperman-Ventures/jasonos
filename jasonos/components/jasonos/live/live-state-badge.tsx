"use client";

import {
  CheckCircle,
  FileDashed,
  MicrophoneSlash,
  MinusCircle,
  NotePencil,
  CalendarCheck,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  liveListStateLabel,
  type LiveListState,
} from "@/components/jasonos/live/live-format";

const STATE_STYLE: Record<
  LiveListState,
  { className: string; Icon: typeof CheckCircle }
> = {
  draft: {
    className: "border-[var(--jos-line)] bg-[var(--jos-surface)] text-[var(--jos-muted)]",
    Icon: FileDashed,
  },
  held: {
    className: "border-[#9aa4b2] bg-[#eef1f4] text-[#334155]",
    Icon: CalendarCheck,
  },
  needs_transcript: {
    className: "border-[#d4a017] bg-[#fff8e6] text-[#8a6d00]",
    Icon: MicrophoneSlash,
  },
  needs_review: {
    className: "border-[#2f6fed] bg-[#eaf1ff] text-[#1d4ed8]",
    Icon: NotePencil,
  },
  reviewed: {
    className: "border-[#2f9e6b] bg-[#e8f7ef] text-[#166534]",
    Icon: CheckCircle,
  },
  no_deck: {
    className: "border-[var(--jos-line)] bg-[var(--jos-bg)] text-[var(--jos-muted)]",
    Icon: MinusCircle,
  },
};

export function LiveStateBadge({
  state,
  className,
}: {
  state: LiveListState;
  className?: string;
}) {
  const style = STATE_STYLE[state];
  const Icon = style.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.04em]",
        style.className,
        className
      )}
    >
      <Icon size={12} weight="bold" aria-hidden />
      {liveListStateLabel(state)}
    </span>
  );
}
