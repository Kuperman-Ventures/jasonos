"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteJobOpportunity } from "@/lib/server-actions/job-opportunities";
import type { JobOpportunity } from "@/lib/data/job-alerts-types";

function formatDate(ymd: string): string {
  const d = new Date(/T/.test(ymd) ? ymd : `${ymd}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
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

function OpportunityRow({
  job,
  pending,
  onDelete,
}: {
  job: JobOpportunity;
  pending: boolean;
  onDelete: (id: string, title: string) => void;
}) {
  const href = job.url;
  const linkSource = job.jobUrl
    ? hostLabel(job.jobUrl)
    : job.gmailUrl
      ? "Gmail alert"
      : null;
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
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm leading-snug">{titleNode}</p>
        {(job.company || job.compensation) && (
          <p className="text-xs leading-snug text-foreground/80">
            {job.company ? (
              <span className="font-medium text-foreground/90">{job.company}</span>
            ) : null}
            {job.company && job.compensation ? (
              <span className="text-muted-foreground"> · </span>
            ) : null}
            {job.compensation ? (
              <span className="tabular-nums text-amber-200/90">
                {job.compensation}
              </span>
            ) : null}
          </p>
        )}
        {linkSource ? (
          <p className="text-[11px] text-muted-foreground">{linkSource}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {formatDate(job.briefDate)}
        </span>
        <button
          type="button"
          title="Delete listing"
          aria-label={`Delete ${job.title}`}
          disabled={pending}
          onClick={() => onDelete(job.id, job.title)}
          className="rounded p-1 text-muted-foreground hover:bg-rose-500/15 hover:text-rose-300 disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

export function OpportunityList({ jobs }: { jobs: JobOpportunity[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const visible = jobs.filter((job) => !hidden.has(job.id));

  const onDelete = (id: string, title: string) => {
    setHidden((prev) => new Set([...prev, id]));
    startTransition(async () => {
      const res = await deleteJobOpportunity(id);
      if (!res.ok) {
        setHidden((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        toast.error(res.error);
        return;
      }
      toast.success(`Deleted “${title.slice(0, 80)}”`);
      router.refresh();
    });
  };

  if (visible.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-xs text-muted-foreground">
        No listings left on this page. Sync will add new ones. Deleted
        listings stay gone.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {visible.map((job) => (
        <OpportunityRow
          key={job.id}
          job={job}
          pending={pending}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}
