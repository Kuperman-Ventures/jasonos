import { Briefcase, ExternalLink } from "lucide-react";
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

function hostLabel(url: string | null): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("mail.google.com")) return "Gmail alert";
    if (host.includes("linkedin.com")) return "LinkedIn";
    if (host.includes("indeed.com")) return "Indeed";
    if (host.includes("theladders.com")) return "Ladders";
    if (host.includes("greenhouse")) return "Greenhouse";
    if (host.includes("lever.co")) return "Lever";
    if (host.includes("ashbyhq.com")) return "Ashby";
    if (host.includes("workday")) return "Workday";
    return host;
  } catch {
    return null;
  }
}

function OpportunityRow({ job }: { job: JobOpportunity }) {
  const href = job.url;
  const source = hostLabel(href);
  const headline = job.roleTitle || job.rawTitle;
  const titleNode = href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-start gap-1.5 font-medium text-sky-300 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-200"
    >
      <span>{headline}</span>
      <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" />
    </a>
  ) : (
    <span className="font-medium text-foreground/90">{headline}</span>
  );

  return (
    <li className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm leading-snug">{titleNode}</p>
        {(job.company || job.salary) && (
          <p className="text-xs leading-snug text-foreground/80">
            {job.company ? (
              <span className="font-medium text-foreground/90">{job.company}</span>
            ) : null}
            {job.company && job.salary ? (
              <span className="text-muted-foreground"> · </span>
            ) : null}
            {job.salary ? (
              <span className="tabular-nums text-amber-200/90">{job.salary}</span>
            ) : null}
          </p>
        )}
        {source ? (
          <p className="text-[11px] text-muted-foreground">{source}</p>
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
  const listingCount = data.opportunities.filter((o) => o.jobUrl).length;
  const withSalaryCount = data.opportunities.filter((o) => o.salary).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <header className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg border bg-card p-2 text-amber-300">
          <Briefcase className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">Job Alerts</h1>
          <p className="text-xs text-muted-foreground">
            Individual opportunities from your morning brief. Links open the
            job listing when we can extract it from the alert email; otherwise
            the Gmail conversation.
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
                {withSalaryCount > 0 ? ` · ${withSalaryCount} with comp` : ""}
                {listingCount > 0 ? ` · ${listingCount} direct listings` : ""}
              </span>
            </div>
            <p className="border-b px-4 py-1.5 text-[11px] text-muted-foreground">
              Roles from the morning brief Job Alerts section (or Job search
              under Email by Group), usually $300K+. Title, company, and salary
              come from what Claude pulled from the alert emails.
            </p>
            {data.opportunities.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                No individual opportunities in recent morning briefs yet. When
                Claude lists linked $300K+ roles in Job Alerts (or under Email
                by Group → Job search), they&rsquo;ll show up here.
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
