"use client";

/** Pin toggle beside the school mark — on = Plan Visit / Visit Planning list. */
export function PlanVisitPin({
  schoolName,
  active,
  onToggle,
}: {
  schoolName: string;
  active: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={`plan-visit-pin${active ? " is-on" : ""}`}
      aria-pressed={active}
      aria-label={
        active
          ? `Remove ${schoolName} from Visit Planning`
          : `Add ${schoolName} to Visit Planning`
      }
      title={active ? "On Visit Planning" : "Add to Visit Planning"}
      onClick={(event) => {
        event.stopPropagation();
        onToggle(!active);
      }}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path
          d="M8 1.5c-2.4 0-4.3 1.9-4.3 4.3 0 3.2 4.3 8.2 4.3 8.2s4.3-5 4.3-8.2C12.3 3.4 10.4 1.5 8 1.5zm0 5.8a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"
          fill="currentColor"
        />
      </svg>
    </button>
  );
}
