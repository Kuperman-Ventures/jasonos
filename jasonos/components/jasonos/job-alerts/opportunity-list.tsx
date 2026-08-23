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
  const label = [job.company, job.title].filter(Boolean).join(" — ") || job.title;

  const titleNode = href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-sky-300 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-200"
    >
      {job.title}
      <ExternalLink className="ml-1 inline h-3.5 w-3.5 opacity-70" />
    </a>
  ) : (
    <span className="font-medium text-foreground/90">{job.title}</span>
  );

  return (
    <li className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1 space-y-0.5">
        {job.company ? (
          <p className="text-sm font-semibold leading-snug text-foreground">
            {job.company}
          </p>
        ) : null}
        <p className="text-sm leading-snug text-foreground/90">{titleNode}</p>
        {job.compensation ? (
          <p className="text-xs tabular-nums text-amber-200/90">
            {job.compensation}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {formatDate(job.briefDate)}
        </span>
        <button
          type="button"
          title="Delete listing"
          aria-label={`Delete ${label}`}
          disabled={pending}
          onClick={() => onDelete(job.id, label)}
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
