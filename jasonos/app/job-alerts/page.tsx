import { AlertTriangle, Briefcase, CheckCircle2, ExternalLink } from "lucide-react";
import {
  getJobAlerts,
  type JobAlertsData,
  type JobOpportunity,
} from "@/lib/data/job-alerts";
import { KeywordCapsules } from "@/components/jasonos/job-alerts/keyword-capsules";
import { ScanNowButton } from "@/components/jasonos/job-alerts/scan-now-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Job Alerts · JasonOS" };

function formatDate(ymd: string): string {
  const d = new Date(/T/.test(ymd) ? ymd : `${ymd}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  });
}

function formatScanTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return formatDate(iso);
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

function LastSyncStatus({ data }: { data: JobAlertsData }) {
  if (!data.lastScanDate && !data.lastResult) return null;
  const result = data.lastResult;
  const failed = Boolean(data.harvestError) || result?.ok === false;
  const listed = result?.listed ?? 0;
  const scanned = result?.scanned ?? data.scannedBriefs;
  const inserted = result?.inserted ?? 0;
  const lookback = result?.lookbackDays ?? 14;
  const folder = data.folderName ?? result?.labelName ?? "Job Alerts";
  const mailbox = data.accountEmail ?? result?.accountEmail;
  const mailboxes = result?.mailboxes?.length ? result.mailboxes : null;

  return (
    <div
      className={
        failed
          ? "rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3"
          : "rounded-lg border bg-card px-4 py-3"
      }
    >
      <div className="flex items-start gap-2">
        {failed ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
        )}
        <div className="min-w-0 text-[12px] leading-relaxed">
          <p className="font-medium text-foreground">
            {failed ? "Last sync failed" : "Last sync succeeded"}
            {data.lastScanDate ? ` · ${formatScanTime(data.lastScanDate)}` : ""}
          </p>
          {failed && data.harvestError ? (
            <p className="mt-1 text-amber-100/90">{data.harvestError}</p>
          ) : (
            <>
              <p className="mt-1 text-muted-foreground">
                Read “{folder}”
                {mailbox ? ` on ${mailbox}` : ""}. {listed} email
                {listed === 1 ? "" : "s"} in the last {lookback} days · {scanned}{" "}
                scanned · {inserted} new listing{inserted === 1 ? "" : "s"}.
              </p>
              {mailboxes && mailboxes.length > 1 ? (
                <ul className="mt-1.5 space-y-0.5 text-muted-foreground">
                  {mailboxes.map((box) => (
                    <li key={`${box.accountEmail}-${box.labelName}`}>
                      {box.accountEmail}: “{box.labelName}” · {box.listed} email
                      {box.listed === 1 ? "" : "s"} · {box.inserted} new
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
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
  const meta = [job.company, job.compensation, source].filter(Boolean).join(" · ");
  const titleNode = href ? (
    <a
      href={href}
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
    <li className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">{titleNode}</p>
        {meta ? (
          <p className="mt-1 text-[11px] text-muted-foreground">{meta}</p>
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
  const listingCount = data.opportunities.filter((o) => o.jobUrl).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <header className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg border bg-card p-2 text-amber-300">
          <Briefcase className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">Job Alerts</h1>
            <div className="ml-auto">
              <ScanNowButton />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Listings pulled from your Gmail Job Alerts folder. Links open the
            job posting when we can extract it; otherwise the Gmail
            conversation.
          </p>
        </div>
      </header>

      {!data.configured ? (
        <div className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Connect Supabase to see job alerts.
        </div>
      ) : (
        <>
          <LastSyncStatus data={data} />
          {!data.gmailConnected ? (
            <p className="rounded-lg border px-4 py-2 text-[12px] text-muted-foreground">
              Connect personal Gmail in Settings so the harvest can read the
              folder.
            </p>
          ) : null}

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
                {matchedCount > 0 ? ` · ${matchedCount} keyword matches` : ""}
                {listingCount > 0 ? ` · ${listingCount} direct listings` : ""}
              </span>
            </div>
            <p className="border-b px-4 py-1.5 text-[11px] text-muted-foreground">
              New emails in that folder are scanned on a weekday schedule.
              Keyword matches float to the top.
            </p>
            {data.opportunities.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
                <p className="text-xs text-muted-foreground">
                  {data.lastResult?.ok
                    ? "Sync ran. That folder had no matching emails in the lookback window. If alerts live in a different Gmail account or folder, tell me the exact name."
                    : "No listings harvested yet. Sync now to read the Gmail folder."}
                </p>
                <ScanNowButton prominent />
              </div>
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
