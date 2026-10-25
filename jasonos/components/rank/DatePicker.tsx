"use client";

import { HOLIDAY_DATES_2026_27 } from "@/config/scoring";
import { addCalendarDays, formatPillDate, isSaturday, todayInNewYork } from "@/lib/scoring/calendar";

export function DatePicker({
  selected,
  onSelect,
  days = 14,
}: {
  selected: string;
  onSelect: (date: string) => void;
  days?: number;
}) {
  const today = todayInNewYork();
  const dates = Array.from({ length: days }, (_, index) => addCalendarDays(today, index));

  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <div className="flex w-max gap-2 pb-1">
        {dates.map((date, index) => {
          const marked = isSaturday(date) || HOLIDAY_DATES_2026_27.includes(date);
          const label = index === 0 ? "Today" : index === 1 ? "Tomorrow" : formatPillDate(date);
          const active = date === selected;
          return (
            <button
              key={date}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(date)}
              className={`flex min-h-11 min-w-16 flex-col items-center justify-center rounded-full px-3 text-sm ${
                active
                  ? "bg-foreground text-background"
                  : "border bg-card text-foreground"
              }`}
            >
              <span>{label}</span>
              <span
                className={`mt-0.5 h-1 w-1 rounded-full ${marked ? "bg-current" : "bg-transparent"}`}
                aria-hidden
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
