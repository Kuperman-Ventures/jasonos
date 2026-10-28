"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  SlotCalendar,
  mondayOf,
} from "@/components/jasonos/browning-networking/slot-calendar";
import { formatSlotLabel } from "@/lib/browning-networking/draft";
import { addCalendarDays } from "@/lib/browning-networking/slots";
import type { BusyBlock, HandoffSlot } from "@/lib/browning-networking/types";
import { fallbackCommitmentEventTitle } from "@/lib/commitments/calendar-title";
import type { CommitmentView } from "@/lib/commitments/types";
import { etToday } from "@/lib/dates";
import {
  loadCommitmentCalendarBusy,
  scheduleCommitmentOnCalendar,
} from "@/lib/server-actions/commitments";

type Props = {
  item: CommitmentView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScheduled?: () => void;
};

/**
 * Pick a free work block (30 or 60 minutes on the Browning week grid) and put it
 * on the Advisors calendar. Jason sets the event title.
 */
export function CommitmentScheduleDialog({
  item,
  open,
  onOpenChange,
  onScheduled,
}: Props) {
  const today = etToday();
  const [weekMonday, setWeekMonday] = useState(() => mondayOf(today));
  const [slots, setSlots] = useState<HandoffSlot[]>([]);
  const [busy, setBusy] = useState<BusyBlock[]>([]);
  const [busyLoading, setBusyLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open || !item) return;
    setWeekMonday(mondayOf(today));
    setSlots([]);
    setTitle(
      fallbackCommitmentEventTitle({
        promise: item.promise,
        to: item.to,
        due_date: item.due_date,
        context: item.context,
      })
    );
  }, [open, item, today]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setBusyLoading(true);
    const toYmd = addCalendarDays(weekMonday, 4);
    void loadCommitmentCalendarBusy(weekMonday, toYmd).then((rows) => {
      if (cancelled) return;
      setBusy(rows);
      setBusyLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, weekMonday]);

  const selected = slots[0] ?? null;

  const placeSlot = (next: HandoffSlot[]) => {
    // One work block at a time — keep the latest click.
    const last = next[next.length - 1];
    setSlots(last ? [last] : []);
  };

  const schedule = () => {
    if (!item || !selected) return;
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error("Enter a calendar title.");
      return;
    }
    start(async () => {
      const result = await scheduleCommitmentOnCalendar({
        itemKey: item.key,
        promise: item.promise,
        to: item.to,
        due_date: item.due_date,
        context: item.context,
        source_url: item.source_url,
        title: trimmed,
        startIso: selected.start,
        endIso: selected.end,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.htmlLink ? (
          <span>
            Added “{result.title}” ·{" "}
            <a
              href={result.htmlLink}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Open in Calendar
            </a>
          </span>
        ) : (
          `Added “${result.title}” to Calendar`
        )
      );
      onOpenChange(false);
      onScheduled?.();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[2px] bg-[var(--jos-bg)] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Schedule commitment work
          </DialogTitle>
          <DialogDescription>
            {item ? (
              <>
                Click a free slot for “{item.promise}”
                {item.to ? ` (to ${item.to})` : ""}. Drag the bottom edge to
                30 or 60 minutes, edit the title, then add it to your calendar.
              </>
            ) : (
              "Pick a free time on your calendar."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <label htmlFor="commitment-event-title" className="text-xs font-medium">
            Calendar title
          </label>
          <Input
            id="commitment-event-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What should this block be called?"
            maxLength={80}
            disabled={pending || !item}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Previous week"
            onClick={() => setWeekMonday(addCalendarDays(weekMonday, -7))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setWeekMonday(mondayOf(today))}
          >
            This week
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Next week"
            onClick={() => setWeekMonday(addCalendarDays(weekMonday, 7))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {busyLoading ? (
            <span className="text-[11px] text-muted-foreground">Loading calendar…</span>
          ) : null}
          {selected ? (
            <span className="ml-auto text-xs text-muted-foreground">
              Selected {formatSlotLabel(selected.start)}
              {" · "}
              {Math.max(
                30,
                Math.round((Date.parse(selected.end) - Date.parse(selected.start)) / 60_000)
              )}
              m
            </span>
          ) : (
            <span className="ml-auto text-xs text-muted-foreground">
              No slot selected
            </span>
          )}
        </div>

        <SlotCalendar
          key={item?.key ?? "closed"}
          slots={slots}
          busy={busy}
          eligibleYmd={today}
          weekMonday={weekMonday}
          allowResize
          onChange={placeSlot}
          onBlocked={(message) => toast.error(message)}
        />

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!selected || pending || !item || !title.trim()}
            onClick={schedule}
          >
            {pending ? "Scheduling…" : "Add to calendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
