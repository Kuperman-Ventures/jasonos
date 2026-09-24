import type { ListPhaseId } from "@/lib/list-phases";

const SIZE = 22;

function IconShell({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <svg
      className="list-phase-icon"
      viewBox="0 0 24 24"
      width={SIZE}
      height={SIZE}
      fill="none"
      aria-hidden="true"
      focusable="false"
      data-phase-icon={label}
    >
      {children}
    </svg>
  );
}

/** Wide-open discovery — compass. */
function ExplorationIcon() {
  return (
    <IconShell label="exploration">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <path
        d="M12 5.5v2.2M12 16.3v2.2M5.5 12h2.2M16.3 12h2.2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M12 12 15.2 8.2 12 12 8.8 15.8 12 12Z"
        fill="currentColor"
        opacity="0.9"
      />
      <path
        d="M12 12 8.8 8.2 12 12 15.2 15.8 12 12Z"
        fill="currentColor"
        opacity="0.35"
      />
    </IconShell>
  );
}

/** Narrowing the field — stacked shortlist / filter. */
function ConsiderationIcon() {
  return (
    <IconShell label="consideration">
      <path
        d="M5 7h14M7.5 12h9M10 17h4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <circle cx="5" cy="7" r="1.6" fill="currentColor" />
      <circle cx="7.5" cy="12" r="1.6" fill="currentColor" />
      <circle cx="10" cy="17" r="1.6" fill="currentColor" />
    </IconShell>
  );
}

/** Submitting applications — document with check. */
function ApplicationsIcon() {
  return (
    <IconShell label="applications">
      <path
        d="M8 3.75h6.2L18.25 8v12.25H8A1.75 1.75 0 0 1 6.25 18.5V5.5A1.75 1.75 0 0 1 8 3.75Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M14.1 3.9V8h3.9" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path
        d="M9.4 13.2 11.1 14.9 14.8 11"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconShell>
  );
}

export function ListPhaseIcon({ phaseId }: { phaseId: ListPhaseId }) {
  if (phaseId === "exploration") return <ExplorationIcon />;
  if (phaseId === "consideration") return <ConsiderationIcon />;
  return <ApplicationsIcon />;
}
