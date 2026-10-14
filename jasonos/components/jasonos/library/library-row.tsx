"use client";

import { Mail, MessageSquare } from "lucide-react";
import { LinkedInIcon } from "@/components/jasonos/library/linkedin-icon";
import { Highlight } from "@/components/jasonos/library/highlight";
import type { LibraryItem } from "@/lib/server-actions/library";
import { formatSentOn, libraryRowContext, librarySnippet } from "@/lib/library/text";
import { cn } from "@/lib/utils";

const ICONS = {
  email: Mail,
  linkedin: LinkedInIcon,
  text: MessageSquare,
} as const;

export function LibraryRow({
  item,
  selected,
  query,
  onSelect,
}: {
  item: LibraryItem;
  selected: boolean;
  query: string;
  onSelect: (id: string) => void;
}) {
  const Icon = ICONS[item.channel];
  return (
    <button
      id={`library-row-${item.id}`}
      type="button"
      onClick={() => onSelect(item.id)}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex w-full flex-col gap-1 border-b border-[var(--jos-line)] px-3.5 py-3.5 text-left",
        selected ? "bg-[var(--jos-surface)]" : "bg-transparent"
      )}
    >
      <div className="flex items-baseline gap-2.5">
        <div
          className={cn(
            "min-w-0 flex-1 truncate text-[16px] leading-[1.3] text-[var(--jos-ink)]",
            selected ? "font-bold" : "font-semibold"
          )}
          title={item.title}
        >
          {item.title}
        </div>
        <div className="shrink-0 text-[13px] text-[var(--jos-muted)] tabular-nums">
          {formatSentOn(item.sentOn)}
        </div>
      </div>
      <div className="line-clamp-2 text-[14px] leading-[1.4] text-[var(--jos-muted)]">
        <Highlight text={librarySnippet(item.body, query)} query={query} />
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 text-[13px] font-medium text-[var(--jos-ink)]">
        <Icon
          className={cn(
            "size-[18px] shrink-0",
            item.channel === "email" ? "text-[var(--color-email)]" : "text-[var(--jos-ink)]"
          )}
          aria-hidden
        />
        <span className="truncate">{libraryRowContext(item)}</span>
      </div>
    </button>
  );
}
