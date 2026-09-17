"use client";

import { useState } from "react";
import { format, parse } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function parseYmd(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = parse(value, "yyyy-MM-dd", new Date());
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function toYmd(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function DatePickerField({
  value,
  onChange,
  placeholder = "Pick a date",
  allowClear = false,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowClear?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseYmd(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        className={cn(
          "inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50",
          !selected && "text-muted-foreground",
          className
        )}
      >
        <span className="truncate">
          {selected ? format(selected, "EEE, MMM d, yyyy") : placeholder}
        </span>
        <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (!date) {
              if (allowClear) onChange("");
              return;
            }
            onChange(toYmd(date));
            setOpen(false);
          }}
        />
        {allowClear && value ? (
          <div className="border-t border-border p-2">
            <button
              type="button"
              className="w-full rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear date
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
