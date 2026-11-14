"use client";

import { TALE_LABEL, type Tale } from "@/lib/lotr/types";

export function TaleFilter({
  tales,
  selected,
  onToggle,
}: {
  tales: Tale[];
  selected: Set<Tale>;
  onToggle: (tale: Tale) => void;
}) {
  return (
    <div className="lotr-tales" role="group" aria-label="Tales">
      {tales.map((tale) => (
        <div key={tale} className="lotr-tale">
          <button
            type="button"
            aria-pressed={selected.has(tale)}
            onClick={() => onToggle(tale)}
          >
            {TALE_LABEL[tale]}
          </button>
        </div>
      ))}
    </div>
  );
}
