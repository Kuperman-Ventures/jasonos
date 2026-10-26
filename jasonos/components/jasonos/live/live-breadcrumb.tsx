import Link from "next/link";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

export function LiveBreadcrumb({
  crumbs,
  className,
}: {
  crumbs: Crumb[];
  className?: string;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("text-[14px] text-[var(--jos-muted)]", className)}
    >
      <ol className="flex flex-wrap items-center gap-x-1.5">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-x-1.5">
              {index > 0 ? <span aria-hidden>›</span> : null}
              {last || !crumb.href ? (
                <span className="font-semibold text-[var(--jos-ink)]">{crumb.label}</span>
              ) : (
                <Link href={crumb.href} className="hover:underline">
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
