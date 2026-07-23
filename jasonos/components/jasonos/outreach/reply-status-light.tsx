"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  REPLY_STATUS_DOT_CLASS,
  REPLY_STATUS_OVERRIDE_HELPERS,
  REPLY_STATUS_OVERRIDE_LABELS,
  REPLY_STATUS_OVERRIDES,
  resolveReplyStatus,
  type ReplyStatusOverride,
  type ReplyTouchLike,
} from "@/lib/outreach/reply-status";
import { setReplyStatusOverride } from "@/lib/server-actions/outreach";

type ReplyStatusLightProps = {
  lastTouch?: ReplyTouchLike | null;
  override?: ReplyStatusOverride;
  overrideAt?: string | null;
  /** When set, the light is clickable and saves a manual override. */
  contactId?: string | null;
  onOverrideChange?: (next: ReplyStatusOverride) => void;
  className?: string;
  /** Dot size. Default matches the queue (h-2.5). Contact card uses larger. */
  size?: "sm" | "md";
};

/**
 * Green / yellow / red / grey reply-status light.
 * Pass `contactId` to make it a dropdown Jason can override by hand
 * (texts aren't tracked automatically).
 */
export function ReplyStatusLight({
  lastTouch = null,
  override = null,
  overrideAt = null,
  contactId = null,
  onOverrideChange,
  className,
  size = "sm",
}: ReplyStatusLightProps) {
  const [nowMs] = useState(() => Date.now());
  const [pending, startTransition] = useTransition();
  const resolved = resolveReplyStatus({
    lastTouch,
    override,
    overrideAt,
    nowMs,
  });

  const dot = (
    <span
      title={
        contactId
          ? `${resolved.title} — click to override`
          : resolved.title
      }
      className={cn(
        "shrink-0 rounded-full",
        size === "md" ? "h-3 w-3" : "h-2.5 w-2.5",
        REPLY_STATUS_DOT_CLASS[resolved.status],
        resolved.isManual && "ring-1 ring-offset-1 ring-offset-background ring-foreground/30",
        pending && "opacity-50",
        className
      )}
    />
  );

  if (!contactId) return dot;

  const apply = (next: ReplyStatusOverride) => {
    const prev = override ?? null;
    onOverrideChange?.(next);
    startTransition(async () => {
      const result = await setReplyStatusOverride(contactId, next);
      if (!result.ok) {
        onOverrideChange?.(prev);
        toast.error(result.error ?? "Couldn't update reply status");
        return;
      }
      toast.success(
        next
          ? `Reply status set to ${REPLY_STATUS_OVERRIDE_LABELS[next].toLowerCase()}`
          : "Reply status back to auto"
      );
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        title={`${resolved.title} — click to override`}
      >
        {dot}
        {size === "md" ? (
          <span className="text-[11px] font-medium text-muted-foreground">
            {labelFor(resolved.status, resolved.isManual)}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        {REPLY_STATUS_OVERRIDES.map((value) => (
          <DropdownMenuItem
            key={value}
            className="cursor-pointer"
            onClick={() => apply(value)}
          >
            <div className="flex items-start gap-2">
              <span
                className={cn(
                  "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                  REPLY_STATUS_DOT_CLASS[value]
                )}
              />
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {REPLY_STATUS_OVERRIDE_LABELS[value]}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {REPLY_STATUS_OVERRIDE_HELPERS[value]}
                </span>
              </div>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => apply(null)}
        >
          <div className="flex flex-col">
            <span className="text-sm font-medium">Use auto</span>
            <span className="text-[10px] text-muted-foreground">
              Derive from the last logged email / LinkedIn / call
            </span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function labelFor(
  status: ReturnType<typeof resolveReplyStatus>["status"],
  isManual: boolean
): string {
  if (status === "replied") return isManual ? "They replied" : "They replied";
  if (status === "waiting") return "Waiting";
  if (status === "overdue") return "No reply";
  return "No messages";
}
