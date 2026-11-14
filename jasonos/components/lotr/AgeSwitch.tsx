"use client";

import type { Age } from "@/lib/lotr/types";

export function AgeSwitch({
  age,
  onChange,
}: {
  age: Age;
  onChange: (age: Age) => void;
}) {
  return (
    <div className="lotr-age" role="group" aria-label="Age">
      <button
        type="button"
        aria-pressed={age === "second"}
        onClick={() => onChange("second")}
      >
        Second Age
      </button>
      <button
        type="button"
        aria-pressed={age === "third"}
        onClick={() => onChange("third")}
      >
        Third Age
      </button>
    </div>
  );
}
