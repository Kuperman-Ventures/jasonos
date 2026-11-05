import type { TimelineView } from "@/lib/projects/oversight-agenda/view";

const mono = "[font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]";

export function Timeline({ view }: { view: TimelineView }) {
  return (
    <section className="border-b-2 border-[var(--color-divider)] py-14">
      <h2 className="m-0 mb-8 text-[32px] font-extrabold tracking-[-0.02em]">What Happens Next</h2>
      <div className="relative pt-14">
        <div
          className="pointer-events-none absolute top-0 flex max-w-full flex-col items-start"
          style={{ left: view.todayLeft }}
        >
          <div className="bg-[var(--color-accent)] px-2.5 py-[5px] text-xs font-bold tracking-[0.1em] whitespace-nowrap text-white uppercase">
            Today / {view.todayLabel}
          </div>
          <div className="h-6 w-0.5 bg-[var(--color-accent)]" />
        </div>
        <ol className="grid border-t-2 border-[var(--color-accent)] [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
          {view.items.map((item) => (
            <li
              key={item.date}
              className="relative min-w-0 pt-5 pr-6"
              style={{ opacity: item.opacity }}
            >
              <div className="-mt-[27px] mb-4 h-3 w-3" style={{ background: item.dot }} />
              <div
                className={`${mono} flex flex-wrap items-center gap-2 text-[13px] font-semibold text-[var(--color-accent-700)]`}
              >
                {item.when}
                {item.tag ? (
                  <span className="bg-[var(--color-text)] px-1.5 py-0.5 font-sans text-[11px] font-bold tracking-[0.08em] text-[var(--color-bg)] uppercase">
                    {item.tag}
                  </span>
                ) : null}
              </div>
              <div className="my-2 text-lg font-bold leading-snug break-words">{item.what}</div>
              <div className="text-sm leading-normal break-words text-[var(--color-neutral-700)]">
                {item.why}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
