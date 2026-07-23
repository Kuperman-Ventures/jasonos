/**
 * Reply-status light — shared resolution for queue rows and the contact card.
 *
 *   green  (replied) = last message came FROM them, or manually pinned
 *   yellow (waiting) = last message was yours / waiting on reply (≤ 10 days)
 *   red    (overdue) = unanswered outbound for more than 10 days
 *   grey   (none)    = no communication logged and no override
 *
 * Manual override wins over auto derivation so texts (and other untracked
 * channels) can be reflected without inventing fake touch rows.
 */

export type ReplyStatus = "replied" | "waiting" | "overdue" | "none";

/** Stored on jasonos.contacts.reply_status_override. null = auto. */
export type ReplyStatusOverride = "replied" | "waiting" | "overdue" | null;

export const REPLY_STATUS_OVERRIDES: Exclude<ReplyStatusOverride, null>[] = [
  "replied",
  "waiting",
  "overdue",
];

export const REPLY_STATUS_OVERRIDE_LABELS: Record<
  Exclude<ReplyStatusOverride, null>,
  string
> = {
  replied: "They replied",
  waiting: "Waiting on reply",
  overdue: "No reply (10d+)",
};

export const REPLY_STATUS_OVERRIDE_HELPERS: Record<
  Exclude<ReplyStatusOverride, null>,
  string
> = {
  replied: "Green — last word was theirs (e.g. they texted back)",
  waiting: "Yellow — you reached out; waiting on them",
  overdue: "Red — your message has gone unanswered too long",
};

export const REPLY_STATUS_DOT_CLASS: Record<ReplyStatus, string> = {
  replied: "bg-emerald-400",
  waiting: "bg-amber-400",
  overdue: "bg-red-400",
  none: "bg-muted-foreground/25",
};

const STALE_DAYS = 10;

export interface ReplyTouchLike {
  direction: "inbound" | "outbound" | string;
  touched_at: string;
}

export function resolveReplyStatus(input: {
  lastTouch: ReplyTouchLike | null | undefined;
  override?: ReplyStatusOverride;
  overrideAt?: string | null;
  nowMs?: number;
}): { status: ReplyStatus; title: string; isManual: boolean } {
  const nowMs = input.nowMs ?? Date.now();
  const override = input.override ?? null;

  if (override) {
    let status: ReplyStatus = override;
    // Waiting overrides age into overdue after 10 days from when they were set,
    // so a "I texted them" pin eventually turns red without another click.
    if (override === "waiting" && input.overrideAt) {
      const days = Math.floor(
        (nowMs - new Date(input.overrideAt).getTime()) / 86_400_000
      );
      if (days > STALE_DAYS) status = "overdue";
    }
    return {
      status,
      title: titleFor(status, { isManual: true, overrideAt: input.overrideAt, nowMs }),
      isManual: true,
    };
  }

  const lastTouch = input.lastTouch ?? null;
  if (!lastTouch) {
    return {
      status: "none",
      title: "No communication logged yet",
      isManual: false,
    };
  }

  const days = Math.floor(
    (nowMs - new Date(lastTouch.touched_at).getTime()) / 86_400_000
  );

  if (lastTouch.direction === "inbound") {
    return {
      status: "replied",
      title: "They replied — last message came from them",
      isManual: false,
    };
  }

  if (days > STALE_DAYS) {
    return {
      status: "overdue",
      title: `Waiting on their reply — ${days} days, no response`,
      isManual: false,
    };
  }

  return {
    status: "waiting",
    title:
      days > 0
        ? `Waiting on their reply — ${days} day${days === 1 ? "" : "s"} so far`
        : "Waiting on their reply",
    isManual: false,
  };
}

function titleFor(
  status: ReplyStatus,
  opts: { isManual: boolean; overrideAt?: string | null; nowMs: number }
): string {
  const manual = opts.isManual ? " (set manually)" : "";
  if (status === "replied") return `They replied${manual}`;
  if (status === "overdue") {
    if (opts.isManual && opts.overrideAt) {
      const days = Math.floor(
        (opts.nowMs - new Date(opts.overrideAt).getTime()) / 86_400_000
      );
      if (days > STALE_DAYS) {
        return `Waiting on their reply — ${days} days, no response${manual}`;
      }
    }
    return `No reply for 10+ days${manual}`;
  }
  if (status === "waiting") {
    if (opts.overrideAt) {
      const days = Math.floor(
        (opts.nowMs - new Date(opts.overrideAt).getTime()) / 86_400_000
      );
      if (days > 0) {
        return `Waiting on their reply — ${days} day${days === 1 ? "" : "s"} so far${manual}`;
      }
    }
    return `Waiting on their reply${manual}`;
  }
  return "No communication logged yet";
}
