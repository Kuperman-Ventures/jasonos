import { getSkiTrackerStatus } from "@/lib/ski-tracker/status";

export const metadata = {
  title: "Ski Tracker · JasonOS",
  description:
    "Weekend ski call: Mountain Creek, a 2-hour Epic mountain, or a hotel overnight.",
};

export const dynamic = "force-dynamic";

export default async function SkiTrackerPage() {
  const payload = await getSkiTrackerStatus();
  const mountainCount = payload.resorts.length;

  return (
    <div className="mx-auto max-w-[720px] space-y-4 px-4 py-6">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Coming soon
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Ski Tracker</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Weekend call: stay at Mountain Creek, drive to a 2-hour Epic mountain,
          or book a hotel overnight.
        </p>
      </header>

      <section className="rounded-xl border bg-card p-4">
        <p className="text-sm leading-relaxed text-foreground/80">
          Rankings will use our rules, including Wyatt&apos;s, so the same snow
          gets the same answer. Weather will come from Open-Meteo. The mountain
          list, Christmas rules, and source links land after Phase 0 research.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Mountains in catalog
            </dt>
            <dd className="mt-1 num-mono text-sm text-foreground">{mountainCount}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Weather / ranking
            </dt>
            <dd className="mt-1 text-sm text-foreground">Not wired yet</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
