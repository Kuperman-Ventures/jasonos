"use client";

import { Loader2, RefreshCw, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addPersonToContacts,
  addSchoolBySlug,
  refreshSchoolBrief,
} from "@/lib/server-actions/professor-roadmap";
import type { ProfessorSchool, RoleKind } from "@/lib/professor-roadmap/types";

const markdownComponents = {
  p: ({ children }: { children?: ReactNode }) => (
    <p className="mt-1 text-sm leading-relaxed text-foreground/80">{children}</p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-foreground/80">
      {children}
    </ul>
  ),
  li: ({ children }: { children?: ReactNode }) => <li>{children}</li>,
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  a: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2"
    >
      {children}
    </a>
  ),
};

function rolePill(kind: RoleKind) {
  return (
    <span className="rounded-[2px] border border-[var(--jos-line)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--jos-muted)]">
      {kind}
    </span>
  );
}

function formatBriefAt(iso: string | null): string {
  if (!iso) return "Never refreshed";
  return `Refreshed ${new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function SchoolCard({ school }: { school: ProfessorSchool }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [contactBusy, setContactBusy] = useState<string | null>(null);

  return (
    <article className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-[var(--jos-ink)]">
            {school.name}
            {school.isPrimary ? (
              <span className="ml-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--jos-action)]">
                Primary
              </span>
            ) : null}
          </h3>
          <p className="mt-0.5 text-xs text-[var(--jos-muted)]">
            {[school.businessSchool, school.department].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-1 text-[11px] text-[var(--jos-muted)]">
            {formatBriefAt(school.briefRefreshedAt)}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={refreshing}
          onClick={() => {
            startRefresh(async () => {
              const result = await refreshSchoolBrief(school.id);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              toast.success("Brief refreshed.");
              router.refresh();
            });
          }}
        >
          {refreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh brief
        </Button>
      </div>

      {school.briefMd ? (
        <div>
          <ReactMarkdown components={markdownComponents}>
            {school.briefMd}
          </ReactMarkdown>
          {school.briefSources.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {school.briefSources.map((source) => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--jos-action)] underline underline-offset-2"
                  >
                    {source.title || source.url}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-[var(--jos-muted)]">
          No brief yet. Refresh to research this school.
        </p>
      )}

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--jos-muted)]">
          People
        </p>
        {school.people.length === 0 ? (
          <p className="mt-1 text-xs text-[var(--jos-muted)]">None yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {school.people.map((person) => (
              <li
                key={person.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--jos-line)] pb-2 last:border-0"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-[var(--jos-ink)]">
                      {person.name}
                    </span>
                    {rolePill(person.roleKind)}
                  </div>
                  {person.title ? (
                    <p className="text-xs text-[var(--jos-muted)]">{person.title}</p>
                  ) : null}
                </div>
                {person.contactId ? (
                  <Link
                    href="/outreach/people"
                    className="text-xs font-semibold text-[var(--jos-action)] underline underline-offset-2"
                  >
                    In contacts
                  </Link>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={contactBusy === person.id}
                    onClick={async () => {
                      setContactBusy(person.id);
                      const result = await addPersonToContacts(person.id);
                      setContactBusy(null);
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      toast.success("Added to contacts.");
                      router.refresh();
                    }}
                  >
                    {contactBusy === person.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UserPlus className="h-3.5 w-3.5" />
                    )}
                    Add to contacts
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--jos-muted)]">
          Postings
        </p>
        {school.postings.length === 0 ? (
          <p className="mt-1 text-xs text-[var(--jos-muted)]">None yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {school.postings.map((posting) => (
              <li key={posting.id} className="text-sm">
                <a
                  href={posting.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[var(--jos-ink)] underline underline-offset-2"
                >
                  {posting.title}
                </a>
                <p className="text-xs text-[var(--jos-muted)]">
                  {[posting.department, posting.degreeRequired]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

export function SchoolBriefPanel({ schools }: { schools: ProfessorSchool[] }) {
  const router = useRouter();
  const [pending, startPending] = useTransition();
  const [form, setForm] = useState({
    name: "",
    businessSchool: "",
    department: "",
    website: "",
    facultyUrl: "",
    jobsUrl: "",
  });

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--jos-muted)]">
          School Brief
        </h2>
        <p className="mt-1 text-xs text-[var(--jos-muted)]">
          Department shape, people, and open postings. Refresh to re-research.
        </p>
      </div>

      <div className="space-y-3">
        {schools.map((school) => (
          <SchoolCard key={school.id} school={school} />
        ))}
      </div>

      <form
        className="space-y-2 rounded-xl border bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.name.trim()) return;
          startPending(async () => {
            const result = await addSchoolBySlug(form);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            setForm({
              name: "",
              businessSchool: "",
              department: "",
              website: "",
              facultyUrl: "",
              jobsUrl: "",
            });
            toast.success("School added.");
            router.refresh();
          });
        }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--jos-muted)]">
          Add school
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["name", "School name"],
              ["businessSchool", "Business school"],
              ["department", "Department"],
              ["website", "Website"],
              ["facultyUrl", "Faculty URL"],
              ["jobsUrl", "Jobs URL"],
            ] as const
          ).map(([key, label]) => (
            <Input
              key={key}
              value={form[key]}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, [key]: e.target.value }))
              }
              placeholder={label}
              required={key === "name"}
              className="text-sm"
            />
          ))}
        </div>
        <Button type="submit" size="sm" disabled={pending || !form.name.trim()}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Add school
        </Button>
      </form>
    </section>
  );
}
