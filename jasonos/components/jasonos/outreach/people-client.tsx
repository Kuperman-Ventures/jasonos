"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Link2,
  Mail,
  Star,
  Tag as TagIcon,
  CalendarClock,
  ListOrdered,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RelationshipBadge } from "@/components/jasonos/outreach/relationship-badge";
import { ClassifyMenu } from "@/components/jasonos/outreach/classify-menu";
import { OutreachModal } from "@/components/jasonos/outreach/outreach-modal";
import {
  CADENCE_LABELS,
  RELATIONSHIP_TYPES,
  RELATIONSHIP_TYPE_LABELS,
  type CadenceInterval,
  type RelationshipType,
} from "@/lib/outreach/types";
import type { OutreachPerson } from "@/lib/outreach/data";

type RelFilter = RelationshipType | "unclassified";

const FILTERS: { value: RelFilter; label: string }[] = [
  { value: "unclassified", label: "Unclassified" },
  ...RELATIONSHIP_TYPES.map((t) => ({
    value: t,
    label: RELATIONSHIP_TYPE_LABELS[t],
  })),
];

export function OutreachPeopleClient({ people }: { people: OutreachPerson[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const firmFilter = searchParams.get("firm");
  const firmFilterNormalized = firmFilter?.trim().toLowerCase() ?? null;

  const [query, setQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<RelFilter>>(
    () => new Set()
  );
  const [classifyTarget, setClassifyTarget] = useState<OutreachPerson | null>(
    null
  );
  const [modalTarget, setModalTarget] = useState<OutreachPerson | null>(null);

  const clearFirmFilter = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("firm");
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname);
  };

  const counts = useMemo(() => {
    const result: Record<RelFilter, number> = {
      unclassified: 0,
      recruiter: 0,
      hiring_manager: 0,
      operator_peer: 0,
      mentor_advisor: 0,
      prospect: 0,
      personal: 0,
    };
    for (const p of people) {
      if (!p.relationship_type) result.unclassified += 1;
      else result[p.relationship_type] += 1;
    }
    return result;
  }, [people]);

  const toggleFilter = (value: RelFilter) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter((p) => {
      if (firmFilterNormalized) {
        if ((p.firm ?? "").trim().toLowerCase() !== firmFilterNormalized) {
          return false;
        }
      }
      if (activeFilters.size > 0) {
        const matches =
          p.relationship_type === null
            ? activeFilters.has("unclassified")
            : activeFilters.has(p.relationship_type);
        if (!matches) return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.firm ?? "").toLowerCase().includes(q) ||
        (p.title ?? "").toLowerCase().includes(q) ||
        (p.primary_email ?? "").toLowerCase().includes(q)
      );
    });
  }, [people, query, activeFilters, firmFilterNormalized]);

  return (
    <>
      <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">People</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Everyone in your relationship system. Classify, set cadence, and
              flag VIPs. Add new people from the global &ldquo;+ Add
              contact&rdquo; button.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/contacts" />}
              title="Bulk-rank contacts and auto-promote the top 30 to ActionQueue"
            >
              <ListOrdered className="h-3.5 w-3.5" />
              Run Tier 1 Ranker
            </Button>
            <div className="text-xs text-muted-foreground">
              <span className="font-mono text-sm text-foreground">
                {filtered.length}
              </span>{" "}
              of <span className="font-mono">{people.length}</span> shown
            </div>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, firm, title, email…"
              className="h-9 pl-8"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {firmFilter ? (
              <button
                type="button"
                onClick={clearFirmFilter}
                title="Clear firm filter"
                className="inline-flex items-center gap-1 rounded-full border border-sky-500/60 bg-sky-500/15 px-2.5 py-1 text-xs text-sky-200 transition-colors hover:bg-sky-500/25"
              >
                <span>
                  Firm: <span className="font-medium">{firmFilter}</span>
                </span>
                <X className="h-3 w-3" />
              </button>
            ) : null}
            <button
              key="all"
              type="button"
              onClick={() => setActiveFilters(new Set())}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                activeFilters.size === 0
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              All
              <span
                className={cn(
                  "ml-1.5 font-mono text-[10px]",
                  activeFilters.size === 0
                    ? "text-background/70"
                    : "text-muted-foreground/70"
                )}
              >
                {people.length}
              </span>
            </button>
            {FILTERS.map((f) => {
              const active = activeFilters.has(f.value);
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => toggleFilter(f.value)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {f.label}
                  <span
                    className={cn(
                      "ml-1.5 font-mono text-[10px]",
                      active
                        ? "text-background/70"
                        : "text-muted-foreground/70"
                    )}
                  >
                    {counts[f.value]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No people match these filters.
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map((person) => (
                <PersonRow
                  key={person.id}
                  person={person}
                  onOpen={() => setModalTarget(person)}
                  onClassify={() => setClassifyTarget(person)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {classifyTarget ? (
        <ClassifyMenu
          open={Boolean(classifyTarget)}
          onOpenChange={(open) => {
            if (!open) setClassifyTarget(null);
          }}
          contact={{
            id: classifyTarget.id,
            name: classifyTarget.name,
            relationship_type: classifyTarget.relationship_type,
            cadence_interval: classifyTarget.cadence_interval,
            vip: classifyTarget.vip,
          }}
        />
      ) : null}

      {modalTarget ? (
        <OutreachModal
          open={Boolean(modalTarget)}
          onOpenChange={(open) => {
            if (!open) setModalTarget(null);
          }}
          contact={{
            id: modalTarget.id,
            name: modalTarget.name,
            title: modalTarget.title,
            firm: modalTarget.firm,
            primary_email: modalTarget.primary_email,
            linkedin_url: modalTarget.linkedin_url,
            vip: modalTarget.vip,
            relationship_type: modalTarget.relationship_type,
            cadence_interval: modalTarget.cadence_interval,
            cadence_stage: modalTarget.cadence_stage,
            intent: modalTarget.intent,
            next_touch_date: modalTarget.next_touch_date,
            last_touch_date: modalTarget.last_touch_date,
          }}
        />
      ) : null}
    </>
  );
}

function PersonRow({
  person,
  onOpen,
  onClassify,
}: {
  person: OutreachPerson;
  onOpen: () => void;
  onClassify: () => void;
}) {
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <li
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 focus:bg-muted/40 focus:outline-none cursor-pointer"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{person.name}</span>
          {person.vip ? (
            <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
          ) : null}
          <RelationshipBadge type={person.relationship_type} />
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          {person.title ? <span className="truncate">{person.title}</span> : null}
          {person.title && person.firm ? <span>·</span> : null}
          {person.firm ? <span className="truncate">{person.firm}</span> : null}
        </div>
      </div>

      <CadenceCell
        cadence={person.cadence_interval}
        nextTouch={person.next_touch_date}
        lastTouch={person.last_touch_date}
      />

      <div className="flex items-center gap-1 shrink-0" onClick={stop}>
        {person.linkedin_url ? (
          <Button
            variant="ghost"
            size="icon-sm"
            title="Open LinkedIn"
            render={
              <a
                href={person.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <Link2 className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        {person.primary_email ? (
          <Button
            variant="ghost"
            size="icon-sm"
            title="Email"
            render={<a href={`mailto:${person.primary_email}`} />}
          >
            <Mail className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onClassify();
          }}
        >
          <TagIcon className="h-3.5 w-3.5" />
          Classify
        </Button>
      </div>
    </li>
  );
}

function CadenceCell({
  cadence,
  nextTouch,
  lastTouch,
}: {
  cadence: CadenceInterval;
  nextTouch: string | null;
  lastTouch: string | null;
}) {
  const isPast = nextTouch && nextTouch <= todayISO();
  return (
    <div className="w-44 shrink-0 text-[11px]">
      <div className="flex items-center gap-1.5">
        <CalendarClock className="h-3 w-3 text-muted-foreground" />
        <span className="font-medium text-foreground/90">
          {CADENCE_LABELS[cadence]}
        </span>
      </div>
      <div className="mt-0.5 text-muted-foreground">
        {nextTouch ? (
          <span className={cn(isPast ? "text-amber-400" : "")}>
            {isPast ? "due " : "next "}
            {fmtRelative(nextTouch)}
          </span>
        ) : lastTouch ? (
          <span>last touch {fmtRelative(lastTouch)}</span>
        ) : (
          <span className="italic">no schedule</span>
        )}
      </div>
    </div>
  );
}

function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

function fmtRelative(dateStr: string) {
  const target = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 0 && days <= 7) return `in ${days}d`;
  if (days < 0 && days >= -30) return `${Math.abs(days)}d ago`;
  return target.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
