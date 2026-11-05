"use client";

import { useState } from "react";
import { AreaCard } from "@/components/projects/oversight-agenda/AreaCard";
import type { Likelihood, OversightArea } from "@/lib/projects/oversight-agenda/data";
import { cn } from "@/lib/utils";

const FILTERS: { id: "all" | Likelihood; label: string }[] = [
  { id: "all", label: "All six" },
  { id: "high", label: "High likelihood" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
];

export function AreaList({ areas }: { areas: OversightArea[] }) {
  const [filter, setFilter] = useState<"all" | Likelihood>("all");
  const shown =
    filter === "all" ? areas : areas.filter((area) => area.likelihood === filter);

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Filter by likelihood" className="flex flex-wrap gap-2">
        {FILTERS.map((item) => {
          const pressed = filter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={pressed}
              onClick={() => setFilter(item.id)}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-xs font-medium",
                pressed
                  ? "border-[var(--jos-ink)] bg-[var(--jos-ink)] text-[var(--jos-bg)]"
                  : "bg-card text-foreground"
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div className="space-y-3">
        {shown.map((area) => (
          <AreaCard key={area.id} area={area} />
        ))}
      </div>
    </div>
  );
}
