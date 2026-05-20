"use client";

// Warmth Maintenance Reminders — surfaces contacts whose cadence has
// drifted (last_touch_date too far behind what cadence_interval says).
// Phase 5A borrow from EncoreOS, adapted to use per-contact cadence.

import { useState } from "react";
import { AlertTriangle, ChevronDown, Star, Tag as TagIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OutreachModal } from "@/components/jasonos/outreach/outreach-modal";
import { RelationshipBadge } from "@/components/jasonos/outreach/relationship-badge";
import type { OutreachPerson, WarmthReminder, WarmthUrgency } from "@/lib/outreach/data";

const URGENCY_CLASS: Record<WarmthUrgency, string> = {
  critical: "border-red-500/40 bg-red-500/10 text-red-300",
  high: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  medium: "border-yellow-500/30 bg-yellow-500/5 text-yellow-300",
};

const URGENCY_LABEL: Record<WarmthUrgency, string> = {
  critical: "Critical",
  high: "High",
  medium: "Watch",
};

function describeOverdue(days: number): string {
  if (!Number.isFinite(days)) return "never touched";
  if (days <= 0) return "due now";
  if (days < 14) return `${days}d overdue`;
  if (days < 60) return `${Math.round(days / 7)}w overdue`;
  return `${Math.round(days / 30)}mo overdue`;
}

interface WarmthWidgetProps {
  reminders: WarmthReminder[];
  /** Optional max rows to show before "Show more" expand. */
  initialLimit?: number;
}

export function WarmthWidget({ reminders, initialLimit = 4 }: WarmthWidgetProps) {
  const [expanded, setExpanded] = useState(false);
  const [modalTarget, setModalTarget] = useState<OutreachPerson | null>(null);

  if (!reminders.length) return null;

  const visible = expanded ? reminders : reminders.slice(0, initialLimit);
  const critical = reminders.filter((r) => r.urgency === "critical").length;
  const high = reminders.filter((r) => r.urgency === "high").length;

  return (
    <>
      <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold tracking-tight">
              Cadence drift
            </h2>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {reminders.length} contact{reminders.length === 1 ? "" : "s"} behind
              {critical > 0 ? ` · ${critical} critical` : ""}
              {high > 0 ? ` · ${high} high` : ""}
            </span>
          </div>
        </header>

        <ul className="mt-2 divide-y divide-amber-500/15">
          {visible.map((r) => (
            <WarmthRow
              key={r.person.id}
              reminder={r}
              onOpen={() => setModalTarget(r.person)}
            />
          ))}
        </ul>

        {reminders.length > initialLimit ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                expanded ? "rotate-180" : ""
              )}
            />
            {expanded
              ? "Show fewer"
              : `Show ${reminders.length - initialLimit} more`}
          </button>
        ) : null}
      </section>

      {modalTarget ? (
        <OutreachModal
          open={Boolean(modalTarget)}
          onOpenChange={(open) => {
            if (!open) setModalTarget(null);
          }}
          contactId={modalTarget.id}
          initialDisplay={{
            name: modalTarget.name,
            title: modalTarget.title,
            firm: modalTarget.firm,
          }}
        />
      ) : null}
    </>
  );
}

function WarmthRow({
  reminder,
  onOpen,
}: {
  reminder: WarmthReminder;
  onOpen: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 py-2">
      <span
        className={cn(
          "shrink-0 rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
          URGENCY_CLASS[reminder.urgency]
        )}
      >
        {URGENCY_LABEL[reminder.urgency]}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {reminder.person.vip ? (
            <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
          ) : null}
          <span className="truncate text-sm font-medium">
            {reminder.person.name}
          </span>
          <RelationshipBadge type={reminder.person.relationship_type} />
        </div>
        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {describeOverdue(reminder.daysOverdue)} · {reminder.suggestedAction}
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onOpen}
        className="shrink-0 text-xs"
      >
        <TagIcon className="h-3 w-3" />
        Open
      </Button>
    </li>
  );
}
