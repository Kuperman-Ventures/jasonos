/** Compact referral-source labels for weekly reports and activity feeds. */

const printMarkStyle = {
  marginLeft: 8,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
};

export function BrowningMark({
  className,
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "print";
}) {
  if (variant === "print") {
    return (
      <span style={{ ...printMarkStyle, color: "var(--color-accent-700)" }}>
        Browning
      </span>
    );
  }
  return (
    <span
      className={
        className ??
        "ml-1.5 text-[10px] font-semibold uppercase tracking-wider text-sky-400/90"
      }
    >
      Browning
    </span>
  );
}

export function JobApplicationMark({
  className,
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "print";
}) {
  if (variant === "print") {
    return (
      <span style={{ ...printMarkStyle, color: "var(--color-accent-2-700)" }}>
        Job app
      </span>
    );
  }
  return (
    <span
      className={
        className ??
        "ml-1.5 text-[10px] font-semibold uppercase tracking-wider text-violet-400/90"
      }
    >
      Job app
    </span>
  );
}

export function BrowningBadge() {
  return (
    <span className="ml-1 shrink-0 rounded-full border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-sky-300">
      Browning
    </span>
  );
}

export function JobApplicationBadge() {
  return (
    <span className="ml-1 shrink-0 rounded-full border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-violet-300">
      Job app
    </span>
  );
}

export function ReferralSourceMarks({
  browning,
  jobApplication,
  variant = "default",
}: {
  browning?: boolean;
  jobApplication?: boolean;
  variant?: "default" | "print";
}) {
  return (
    <>
      {browning ? <BrowningMark variant={variant} /> : null}
      {jobApplication ? <JobApplicationMark variant={variant} /> : null}
    </>
  );
}

export function ReferralSourceBadges({
  browning,
  jobApplication,
}: {
  browning?: boolean;
  jobApplication?: boolean;
}) {
  return (
    <>
      {browning ? <BrowningBadge /> : null}
      {jobApplication ? <JobApplicationBadge /> : null}
    </>
  );
}
