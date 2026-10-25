"use client";

import { addCalendarDays, formatPillDate, todayInNewYork } from "@/lib/scoring/calendar";

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
    <div className="-mr-[18px] overflow-x-auto">
      <div className="flex w-max snap-x gap-2 pb-1">
        {dates.map((date, index) => {
          const label = index === 0 ? "Today" : index === 1 ? "Tomorrow" : formatPillDate(date);
          const active = date === selected;
          return (
            <button
              key={date}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(date)}
              className={`min-h-11 shrink-0 snap-start rounded-[20px] px-3.5 text-sm font-bold ${
                active ? "bg-[#0b1d33] text-[#f4f8fb]" : "bg-[#d6eaf7] text-[#0b1d33]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
