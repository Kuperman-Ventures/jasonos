import { Briefcase, Inbox, Target } from "lucide-react";
import { getJobAlerts, type JobAlert } from "@/lib/data/job-alerts";
import { BriefText } from "@/components/jasonos/home/brief-text";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Job Alerts · JasonOS" };

function formatDate(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function AlertRow({ alert }: { alert: JobAlert }) {
  return (
    <li className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-foreground/90">
          {alert.url ? (
            <a
              href={alert.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-sky-300 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-200"
            >
              {alert.text}
            </a>
          ) : (
            <BriefText text={alert.text} />
          )}
        </p>
        {alert.matchedTitles.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {alert.matchedTitles.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-200"
              >
                <Target className="h-2.5 w-2.5" />
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
        {formatDate(alert.briefDate)}
      </span>
    </li>
  );
}

function AlertList({
  title,
  icon,
  hint,
  alerts,
  emptyText,
}: {
  title: string;
  icon: React.ReactNode;
  hint?: string;
  alerts: JobAlert[];
  emptyText: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            {title}
          </h2>
        </div>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
          {alerts.length}
        </span>
      </div>
      {hint ? (
        <p className="border-b px-4 py-1.5 text-[11px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {alerts.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {alerts.map((a) => (
            <AlertRow key={a.id} alert={a} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function JobAlertsPage() {
  const data = await getJobAlerts();

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <header className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg border bg-card p-2 text-amber-300">
          <Briefcase className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">Job Alerts</h1>
          <p className="text-xs text-muted-foreground">
            Opportunities pulled from the Job search bucket of your morning
            brief, matched to the roles you&rsquo;re tracking in NYUI.
            {data.lastScanDate
              ? ` Last scan ${formatDate(data.lastScanDate)}.`
              : ""}
          </p>
        </div>
      </header>

      {!data.configured ? (
        <div className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Connect Supabase to see job alerts.
        </div>
      ) : (
        <>
          {data.trackedTitles.length > 0 ? (
            <section className="rounded-xl border bg-card p-4">
              <div className="mb-2 flex items-center gap-1.5 text-muted-foreground">
                <Target className="h-3.5 w-3.5" />
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80">
                  Roles you&rsquo;re tracking
                </h2>
                <span className="text-[11px] text-muted-foreground">
                  from NYUI · {data.trackedTitles.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.trackedTitles.slice(0, 24).map((t) => (
                  <span
                    key={t}
                    className="rounded-md border bg-background/60 px-2 py-0.5 text-[11px] text-foreground/80"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <AlertList
            title="Matching your tracked roles"
            icon={<Target className="h-4 w-4 text-emerald-300" />}
            hint="Job-search items whose titles line up with roles you've logged in NYUI."
            alerts={data.matched}
            emptyText={
              data.trackedTitles.length === 0
                ? "Log a few roles in NYUI to start matching opportunities."
                : "No opportunities matched your tracked roles in recent briefs."
            }
          />

          <AlertList
            title="Other job-search items"
            icon={<Inbox className="h-4 w-4 text-sky-300" />}
            hint="Everything else that landed in the Job search bucket."
            alerts={data.other}
            emptyText="Nothing else in the Job search bucket recently."
          />
        </>
      )}
    </div>
  );
}
