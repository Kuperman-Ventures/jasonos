"use client";

import { useMemo, useState } from "react";
import { format, parse } from "date-fns";
import { CalendarDays, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { daysBetweenYmd, etToday } from "@/lib/dates";
import {
  SENT_FOLLOWUP_DAY_PRESETS,
  SENT_FOLLOWUP_MAX_DAYS,
  followUpDueYmd,
} from "@/lib/outreach/sent-followups";

export function SentFollowupControls({
  busy,
  onSchedule,
  onDismiss,
  onDone,
}: {
  busy: boolean;
  onSchedule: (days: number) => void;
  onDismiss?: () => void;
  onDone?: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const today = etToday();
  const minYmd = followUpDueYmd(today, 1) ?? today;
  const maxYmd =
    followUpDueYmd(today, SENT_FOLLOWUP_MAX_DAYS) ??
    followUpDueYmd(today, 1) ??
    today;
  const minDate = useMemo(
    () => parse(minYmd, "yyyy-MM-dd", new Date()),
    [minYmd]
  );
  const maxDate = useMemo(
    () => parse(maxYmd, "yyyy-MM-dd", new Date()),
    [maxYmd]
  );

  const pickDate = (date: Date | undefined) => {
    if (!date) return;
    const ymd = format(date, "yyyy-MM-dd");
    const days = daysBetweenYmd(today, ymd);
    if (days < 1 || days > SENT_FOLLOWUP_MAX_DAYS) return;
    onSchedule(days);
    setPickerOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {SENT_FOLLOWUP_DAY_PRESETS.map((days) => (
        <Button
          key={days}
          type="button"
          size="sm"
          variant="emailOutline"
          disabled={busy}
          onClick={() => onSchedule(days)}
        >
          {days} day{days === 1 ? "" : "s"}
        </Button>
      ))}
      <Button
        type="button"
        size="sm"
        variant="emailOutline"
        disabled={busy}
        onClick={() => setPickerOpen(true)}
        aria-label="Pick a follow-up date"
      >
        <CalendarDays className="h-3.5 w-3.5" />
        Date
      </Button>
      {onDone ? (
        <Button type="button" size="sm" variant="email" disabled={busy} onClick={onDone}>
          Done
        </Button>
      ) : null}
      {onDismiss ? (
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onDismiss}>
          No follow-up
        </Button>
      ) : null}
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="w-auto max-w-[calc(100vw-2rem)] rounded-[2px] bg-[var(--jos-bg)] p-4 sm:max-w-fit">
          <DialogHeader>
            <DialogTitle>Follow up on</DialogTitle>
            <DialogDescription>
              Pick the day this email should come back. Presets stay on the row.
            </DialogDescription>
          </DialogHeader>
          <Calendar
            mode="single"
            defaultMonth={minDate}
            disabled={{ before: minDate, after: maxDate }}
            onSelect={pickDate}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
