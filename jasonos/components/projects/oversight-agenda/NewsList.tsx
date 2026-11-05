import type { NewsCard } from "@/lib/projects/oversight-agenda/view";

const mono = "[font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]";

export function NewsList({
  items,
  updatedOn,
}: {
  items: NewsCard[];
  updatedOn: string;
}) {
  return (
    <section className="border-b-2 border-[var(--color-divider)] py-12">
      <div className="mb-7 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="m-0 text-[32px] font-extrabold tracking-[-0.02em]">Latest News</h2>
        <div className={`${mono} text-[13px] text-[var(--color-neutral-600)]`}>
          {items.length} stories / {updatedOn}
        </div>
      </div>
      <div className="grid gap-px border-y border-b-[var(--color-neutral-300)] border-t-2 border-t-[var(--color-text)] bg-[var(--color-neutral-300)] [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        {items.map((item) => (
          <a
            key={item.url}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[240px] min-w-0 flex-col justify-between gap-10 bg-[var(--color-bg)] p-6 text-[var(--color-text)] no-underline hover:bg-[var(--color-neutral-100)]"
          >
            <div className="min-w-0">
              <div className="mb-[18px] flex items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.icon}
                  width={24}
                  height={24}
                  alt=""
                  className="block h-6 w-6 border border-[var(--color-neutral-300)] bg-white object-contain p-0.5"
                />
                <span className="text-xs font-bold tracking-[0.1em] uppercase">{item.outlet}</span>
                <span className="ml-auto text-[11px] font-bold tracking-[0.08em] text-[var(--color-neutral-600)] uppercase">
                  {item.domain}
                </span>
              </div>
              <div className="text-[22px] font-bold leading-tight tracking-[-0.01em] text-balance break-words">
                {item.headline}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-[var(--color-neutral-300)] pt-3.5">
              <div className={`${mono} flex items-center gap-2 text-xs text-[var(--color-neutral-700)]`}>
                <span className="h-2 w-2 shrink-0" style={{ background: item.dot }} />
                {item.age} / {item.dateLabel}
              </div>
              <div className="text-[13px] font-bold text-[var(--color-accent-700)]">Read story →</div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
