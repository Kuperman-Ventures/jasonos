import { AreaCard } from "@/components/projects/oversight-agenda/AreaCard";
import type { Likelihood, OversightArea } from "@/lib/projects/oversight-agenda/data";
import { cn } from "@/lib/utils";

const FILTERS: { id: "all" | Likelihood; label: string }[] = [
  { id: "all", label: "All six" },
  { id: "high", label: "High likelihood" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
];

export function AreaList({
  areas,
  filter,
  onFilter,
}: {
  areas: OversightArea[];
  filter: "all" | Likelihood;
  onFilter: (filter: "all" | Likelihood) => void;
}) {
  const shown =
    filter === "all" ? areas : areas.filter((area) => area.likelihood === filter);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <h2 className="m-0 text-[32px] font-extrabold tracking-[-0.02em]">Investigation Areas</h2>
        <div
          role="group"
          aria-label="Filter by likelihood"
          className="flex max-w-full flex-wrap border-2 border-[var(--color-text)]"
        >
          {FILTERS.map((item) => {
            const pressed = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={pressed}
                onClick={() => onFilter(item.id)}
                className={cn(
                  "border-r border-[var(--color-text)] px-4 py-2.5 text-left text-sm font-semibold",
                  pressed
                    ? "bg-[var(--color-text)] text-[var(--color-bg)]"
                    : "bg-transparent text-[var(--color-text)]"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-6">
        {shown.map((area) => (
          <AreaCard key={area.id} area={area} />
        ))}
      </div>
    </div>
  );
}
