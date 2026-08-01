import { Briefcase, ExternalLink, Target } from "lucide-react";
import {
  getJobAlerts,
  type JobOpportunity,
} from "@/lib/data/job-alerts";
import { KeywordCapsules } from "@/components/jasonos/job-alerts/keyword-capsules";

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

function OpportunityRow({ job }: { job: JobOpportunity }) {
  const titleNode = job.url ? (
    <a
      href={job.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-start gap-1.5 font-medium text-sky-300 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-200"
    >
      <span>{job.title}</span>
      <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" />
    </a>
  ) : (
    <span className="font-medium text-foreground/90">{job.title}</span>
  );

  return (
    <li className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">{titleNode}</p>
        {job.matchedKeywords.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {job.matchedKeywords.map((t) => (
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
        {formatDate(job.briefDate)}
      </span>
    </li>
  );
}

export default async function JobAlertsPage() {
  const data = await getJobAlerts();
  const matchedCount = data.opportunities.filter(
    (o) => o.matchedKeywords.length > 0
  ).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <header className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg border bg-card p-2 text-amber-300">
          <Briefcase className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">Job Alerts</h1>
          <p className="text-xs text-muted-foreground">
            Individual opportunities harvested from your morning brief&rsquo;s
            Job Alerts section. Click through to open the posting or Gmail
            alert.
            {data.lastScanDate
              ? ` Last harvest ${formatDate(data.lastScanDate)}.`
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
          <KeywordCapsules initial={data.keywords} />

          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Briefcase className="h-4 w-4 text-amber-300" />
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  Opportunities
                </h2>
              </div>
              <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                {data.opportunities.length}
                {matchedCount > 0 ? ` · ${matchedCount} match keywords` : ""}
              </span>
            </div>
            <p className="border-b px-4 py-1.5 text-[11px] text-muted-foreground">
              Roles Claude pulled from job-alert emails (usually $300K+). Ones
              that hit your keywords float to the top.
            </p>
            {data.opportunities.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                No individual opportunities in recent morning briefs yet. When
                Claude includes a &ldquo;Job Alerts&rdquo; section with linked
                roles, they&rsquo;ll show up here.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {data.opportunities.map((job) => (
                  <OpportunityRow key={job.id} job={job} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
