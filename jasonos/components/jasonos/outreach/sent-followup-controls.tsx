"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SENT_FOLLOWUP_DAY_PRESETS } from "@/lib/outreach/sent-followups";

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
  const [custom, setCustom] = useState("");

  const submitCustom = () => {
    const days = Number(custom);
    if (!Number.isInteger(days)) return;
    onSchedule(days);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {SENT_FOLLOWUP_DAY_PRESETS.map((days) => (
        <Button
          key={days}
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => onSchedule(days)}
        >
          {days} day{days === 1 ? "" : "s"}
        </Button>
      ))}
      <form
        className="flex items-center gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          submitCustom();
        }}
      >
        <Input
          type="number"
          min={1}
          max={365}
          inputMode="numeric"
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          placeholder="Days"
          aria-label="Follow up in this many days"
          className="h-8 w-16 px-2 text-xs"
          disabled={busy}
        />
        <Button type="submit" size="sm" variant="outline" disabled={busy || !custom.trim()}>
          Set
        </Button>
      </form>
      {onDone ? (
        <Button type="button" size="sm" disabled={busy} onClick={onDone}>
          Done
        </Button>
      ) : null}
      {onDismiss ? (
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onDismiss}>
          No follow-up
        </Button>
      ) : null}
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
    </div>
  );
}
