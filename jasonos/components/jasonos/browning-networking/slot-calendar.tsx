"use client";

import { useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { etYmd } from "@/lib/dates";
import { formatSlotLabel } from "@/lib/browning-networking/draft";
import {
  addCalendarDays,
  slotOverlaps,
  weekdayIndex,
} from "@/lib/browning-networking/slots";
import type { BusyBlock } from "@/lib/browning-networking/types";
import { SLOT_MINUTES, type HandoffSlot } from "@/lib/browning-networking/types";

const START_HOUR = 8;
const END_HOUR = 19;
const PX_PER_HOUR = 48;
const ET = "America/New_York";

type Props = {
  slots: HandoffSlot[];
  busy: BusyBlock[];
  eligibleYmd: string;
  weekMonday: string;
  onChange: (slots: HandoffSlot[]) => void;
};

export function SlotCalendar({ slots, busy, eligibleYmd, weekMonday, onChange }: Props) {
  const days = useMemo(() => weekdaysOf(weekMonday), [weekMonday]);
  const [local, setLocal] = useState(slots);

  function commit(next: HandoffSlot[]) {
    setLocal(next);
    onChange(next);
  }

  function addAt(ymd: string, startMin: number) {
    if (ymd < eligibleYmd) return;
    const start = etIso(ymd, startMin);
    const end = new Date(Date.parse(start) + SLOT_MINUTES * 60_000).toISOString();
    if (slotOverlaps(start, end, local)) return;
    commit([...local, { id: `slot-${start}`, start, end }]);
  }

  function previewMove(id: string, ymd: string, startMin: number) {
    if (ymd < eligibleYmd) return;
    const start = etIso(ymd, startMin);
    const end = new Date(Date.parse(start) + SLOT_MINUTES * 60_000).toISOString();
    const others = local.filter((slot) => slot.id !== id);
    if (slotOverlaps(start, end, others)) return;
    setLocal(local.map((slot) => (slot.id === id ? { ...slot, start, end } : slot)));
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <div
        className="grid min-w-[720px]"
        style={{ gridTemplateColumns: `52px repeat(${days.length}, minmax(0, 1fr))` }}
      >
        <div />
        {days.map((day) => (
          <div key={day.ymd} className="border-b px-2 py-2 text-center">
            <div className="text-[11px] text-muted-foreground">{day.label}</div>
            <div className="text-sm font-medium">{day.dateLabel}</div>
          </div>
        ))}
        <div className="relative" style={{ height: (END_HOUR - START_HOUR) * PX_PER_HOUR }}>
          {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
            <div
              key={i}
              className="absolute right-1 text-[10px] text-muted-foreground"
              style={{ top: i * PX_PER_HOUR - 6 }}
            >
              {hourLabel(START_HOUR + i)}
            </div>
          ))}
        </div>
        {days.map((day) => (
          <DayColumn
            key={day.ymd}
            ymd={day.ymd}
            locked={day.ymd < eligibleYmd}
            slots={local.filter((slot) => etYmd(slot.start) === day.ymd)}
            busy={busy.filter((block) => blockHitsDay(block, day.ymd))}
            onAdd={(min) => addAt(day.ymd, min)}
            onPreviewMove={(id, min) => previewMove(id, day.ymd, min)}
            onCommitMove={() => onChange(local)}
            onRemove={(id) => commit(local.filter((slot) => slot.id !== id))}
          />
        ))}
      </div>
    </div>
  );
}

function DayColumn({
  ymd,
  locked,
  slots,
  busy,
  onAdd,
  onPreviewMove,
  onCommitMove,
  onRemove,
}: {
  ymd: string;
  locked: boolean;
  slots: HandoffSlot[];
  busy: BusyBlock[];
  onAdd: (startMin: number) => void;
  onPreviewMove: (id: string, startMin: number) => void;
  onCommitMove: () => void;
  onRemove: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const height = (END_HOUR - START_HOUR) * PX_PER_HOUR;

  function minutesAt(clientY: number): number {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return START_HOUR * 60;
    const y = Math.min(Math.max(clientY - rect.top, 0), height);
    const raw = START_HOUR * 60 + (y / PX_PER_HOUR) * 60;
    const snapped = Math.round(raw / 30) * 30;
    return Math.min(Math.max(snapped, START_HOUR * 60), (END_HOUR - 1) * 60);
  }

  return (
    <div
      ref={ref}
      className={`relative border-l ${locked ? "bg-muted/40" : "bg-background"}`}
      style={{ height }}
      onClick={(event) => {
        if (locked) return;
        if ((event.target as HTMLElement).closest("[data-slot]")) return;
        onAdd(minutesAt(event.clientY));
      }}
    >
      {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
        <div
          key={i}
          className="pointer-events-none absolute inset-x-0 border-t border-border/60"
          style={{ top: i * PX_PER_HOUR }}
        />
      ))}
      {busy.map((block) => {
        const pos = blockPosition(block, ymd);
        if (!pos) return null;
        return (
          <div
            key={`${block.title}-${block.start}`}
            className="pointer-events-none absolute inset-x-1 overflow-hidden rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground"
            style={{ top: pos.top, height: pos.height }}
            title={block.title}
          >
            {block.title}
          </div>
        );
      })}
      {slots.map((slot) => (
        <SlotBlock
          key={slot.id}
          slot={slot}
          conflict={busy.some((block) => rangesOverlap(slot.start, slot.end, block, ymd))}
          onPreviewMove={(min) => onPreviewMove(slot.id, min)}
          onCommitMove={onCommitMove}
          onRemove={() => onRemove(slot.id)}
          minutesAt={minutesAt}
        />
      ))}
    </div>
  );
}

function SlotBlock({
  slot,
  conflict,
  onPreviewMove,
  onCommitMove,
  onRemove,
  minutesAt,
}: {
  slot: HandoffSlot;
  conflict: boolean;
  onPreviewMove: (startMin: number) => void;
  onCommitMove: () => void;
  onRemove: () => void;
  minutesAt: (clientY: number) => number;
}) {
  const [dragging, setDragging] = useState(false);
  const top = minutesToPx(etMinutes(slot.start));
  const height = Math.max(22, ((Date.parse(slot.end) - Date.parse(slot.start)) / 3600000) * PX_PER_HOUR);

  return (
    <div
      data-slot
      className={`absolute inset-x-1 z-10 cursor-grab rounded border px-1 py-0.5 text-[10px] leading-tight text-amber-950 ${
        conflict ? "border-red-700 bg-red-200" : "border-amber-700 bg-amber-300"
      } ${dragging ? "opacity-80" : ""}`}
      style={{ top, height }}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest("button")) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
      }}
      onPointerMove={(event) => {
        if (!dragging) return;
        onPreviewMove(minutesAt(event.clientY));
      }}
      onPointerUp={() => {
        if (!dragging) return;
        setDragging(false);
        onCommitMove();
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <span>{formatSlotLabel(slot.start).replace(" ET", "")}</span>
        <button
          type="button"
          className="rounded p-0.5 hover:bg-black/10"
          aria-label="Remove this time"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function weekdaysOf(monday: string): { ymd: string; label: string; dateLabel: string }[] {
  return Array.from({ length: 5 }, (_, i) => {
    const ymd = addCalendarDays(monday, i);
    const date = new Date(`${ymd}T12:00:00Z`);
    return {
      ymd,
      label: date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
      dateLabel: date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
    };
  });
}

export function mondayOf(ymd: string): string {
  const index = weekdayIndex(ymd);
  const back = index === 0 ? 6 : index - 1;
  return addCalendarDays(ymd, -back);
}

function etMinutes(iso: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return (Number(map.hour) % 24) * 60 + Number(map.minute);
}

function minutesToPx(minutes: number): number {
  return ((minutes - START_HOUR * 60) / 60) * PX_PER_HOUR;
}

function hourLabel(hour: number): string {
  const suffix = hour >= 12 ? "pm" : "am";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}${suffix}`;
}

function etIso(ymd: string, minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const guess = new Date(
    Date.UTC(
      Number(ymd.slice(0, 4)),
      Number(ymd.slice(5, 7)) - 1,
      Number(ymd.slice(8, 10)),
      hour,
      minute
    )
  );
  const offset = tzOffsetMinutes(guess);
  const corrected = new Date(guess.getTime() - offset * 60_000);
  const check = tzOffsetMinutes(corrected);
  return (check === offset ? corrected : new Date(guess.getTime() - check * 60_000)).toISOString();
}

function tzOffsetMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour) % 24,
    Number(map.minute),
    Number(map.second)
  );
  return Math.round((asUtc - date.getTime()) / 60_000);
}

function blockHitsDay(block: BusyBlock, ymd: string): boolean {
  if (block.allDay) {
    const start = block.start.slice(0, 10);
    const end = block.end.slice(0, 10);
    if (!block.start.includes("T")) return ymd >= start && ymd < end;
    return etYmd(block.start) === ymd;
  }
  return etYmd(block.start) === ymd || etYmd(block.end) === ymd;
}

function blockPosition(block: BusyBlock, ymd: string): { top: number; height: number } | null {
  if (block.allDay) return { top: 0, height: 18 };
  const startMin = etYmd(block.start) === ymd ? etMinutes(block.start) : START_HOUR * 60;
  const endMin = etYmd(block.end) === ymd ? etMinutes(block.end) : END_HOUR * 60;
  const top = minutesToPx(Math.max(startMin, START_HOUR * 60));
  const bottom = minutesToPx(Math.min(endMin, END_HOUR * 60));
  if (bottom <= top) return null;
  return { top, height: bottom - top };
}

function rangesOverlap(start: string, end: string, block: BusyBlock, ymd: string): boolean {
  if (block.allDay && blockHitsDay(block, ymd)) return true;
  const a1 = Date.parse(start);
  const a2 = Date.parse(end);
  const b1 = Date.parse(block.start);
  const b2 = Date.parse(block.end);
  if (![a1, a2, b1, b2].every(Number.isFinite)) return false;
  return a1 < b2 && a2 > b1;
}
