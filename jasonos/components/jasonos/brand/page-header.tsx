import { cn } from "@/lib/utils";

export function PageHeader({
  kicker,
  title,
  description,
  actions,
  mark,
  className,
}: {
  kicker?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  mark?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {mark}
        <div className="min-w-0">
          {kicker ? (
            <p className="text-[13px] font-bold tracking-[0.1em] text-[var(--color-accent-700)] uppercase">
              {kicker}
            </p>
          ) : null}
          <h1 className="text-[44px] leading-none font-extrabold tracking-[-0.02em] text-[var(--jos-ink)]">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-[65ch] text-[17px] leading-normal text-[var(--jos-muted)]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
