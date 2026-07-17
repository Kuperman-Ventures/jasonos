"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  Link2,
  Mail,
  Star,
  Tag as TagIcon,
  ListOrdered,
  Archive,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RelationshipBadge } from "@/components/jasonos/outreach/relationship-badge";
import { TierDegreeBadge } from "@/components/jasonos/outreach/tier-degree-badge";
import { OutreachModal } from "@/components/jasonos/outreach/outreach-modal";
import {
  CADENCE_INTERVALS,
  CADENCE_LABELS,
  CONTACT_INTENTS,
  CONTACT_INTENT_LABELS,
  NETWORK_DEGREES,
  NETWORK_DEGREE_LABELS,
  RELATIONSHIP_TYPES,
  RELATIONSHIP_TYPE_LABELS,
  RELEVANCE_TIERS,
  RELEVANCE_TIER_LABELS,
  type CadenceInterval,
  type ContactIntent,
  type NetworkDegree,
  type RelationshipType,
  type RelevanceTier,
} from "@/lib/outreach/types";
import {
  setCadence,
  setContactIntent,
  setNetworkDegree,
  setRelationshipType,
  setRelevanceTier,
} from "@/lib/server-actions/outreach";
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
      if (p.intent === null) result.unclassified += 1;
      if (p.relationship_type) result[p.relationship_type] += 1;
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
          (activeFilters.has("unclassified") && p.intent === null) ||
          (p.relationship_type !== null &&
            activeFilters.has(p.relationship_type));
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
                  // Composite key so the row remounts (re-seeding its dropdown
                  // state from fresh props) whenever any classification changes
                  // — from these dropdowns or the contact modal.
                  key={[
                    person.id,
                    person.relevance_tier ?? "",
                    person.network_degree ?? "",
                    person.intent ?? "",
                    person.cadence_interval,
                    person.relationship_type ?? "",
                  ].join(":")}
                  person={person}
                  onOpen={() => setModalTarget(person)}
                  onSaved={() => router.refresh()}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {modalTarget ? (
        <OutreachModal
          open={Boolean(modalTarget)}
          onOpenChange={(open) => {
            if (!open) setModalTarget(null);
          }}
          contactId={modalTarget.id}
          initialDisplay={{
            name: modalTarget.name,
            title: modalTarget.title,
            firm: modalTarget.firm,
          }}
        />
      ) : null}
    </>
  );
}

function PersonRow({
  person,
  onOpen,
  onSaved,
}: {
  person: OutreachPerson;
  onOpen: () => void;
  onSaved: () => void;
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
      <div className="min-w-0 flex-1 basis-52">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{person.name}</span>
          <TierDegreeBadge
            tier={person.relevance_tier}
            degree={person.network_degree}
          />
          {person.vip ? (
            <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
          ) : null}
          {person.intent === "backrow" ? (
            <span
              title="Removed from queue — kept in your contacts list."
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-border bg-muted/40 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground"
            >
              <Archive className="h-2.5 w-2.5" />
              Backrow
            </span>
          ) : null}
          <RelationshipBadge type={person.relationship_type} />
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          {person.title ? <span className="truncate">{person.title}</span> : null}
          {person.title && person.firm ? <span>·</span> : null}
          {person.firm ? <span className="truncate">{person.firm}</span> : null}
          <span>·</span>
          <span className={cn(scheduleIsPast(person) ? "text-amber-400" : "")}>
            {scheduleHint(person)}
          </span>
        </div>
      </div>

      <PersonControls person={person} onSaved={onSaved} onStop={stop} />

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
            onOpen();
          }}
        >
          <TagIcon className="h-3.5 w-3.5" />
          Open
        </Button>
      </div>
    </li>
  );
}

// ─── Inline classification dropdowns ────────────────────────────────────────

const SELECT_CLS =
  "h-7 rounded-md border border-border bg-background px-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

function ControlField({
  label,
  title,
  children,
}: {
  label: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-0.5" title={title}>
      <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function PersonControls({
  person,
  onSaved,
  onStop,
}: {
  person: OutreachPerson;
  onSaved: () => void;
  onStop: (e: React.MouseEvent) => void;
}) {
  const [pending, startTransition] = useTransition();
  // Optimistic local state seeded from props. The row remounts (new key) after
  // onSaved -> router.refresh, so these stay in sync with any external edits.
  const [relevance, setRelevance] = useState(person.relevance_tier ?? "");
  const [degree, setDegree] = useState(
    person.network_degree != null ? String(person.network_degree) : ""
  );
  const [intent, setIntentVal] = useState<string>(person.intent ?? "");
  const [cadence, setCadenceVal] = useState<string>(person.cadence_interval);
  const [rel, setRel] = useState<string>(person.relationship_type ?? "");

  function commit(
    apply: () => Promise<{ ok: true } | { ok: false; error: string }>,
    revert: () => void
  ) {
    startTransition(async () => {
      const result = await apply();
      if (!result.ok) {
        revert();
        toast.error(result.error);
        return;
      }
      onSaved();
    });
  }

  return (
    <div
      className={cn("flex flex-wrap items-end gap-1.5", pending && "opacity-60")}
      onClick={onStop}
    >
      <ControlField label="A/B/C" title="Relevance — A most relevant → C least">
        <select
          className={SELECT_CLS}
          value={relevance}
          disabled={pending}
          onChange={(e) => {
            const prev = relevance;
            const next = e.target.value;
            setRelevance(next);
            commit(
              () =>
                setRelevanceTier(
                  person.id,
                  (next || null) as RelevanceTier | null
                ),
              () => setRelevance(prev)
            );
          }}
        >
          <option value="">—</option>
          {RELEVANCE_TIERS.map((t) => (
            <option key={t} value={t} title={RELEVANCE_TIER_LABELS[t]}>
              {t}
            </option>
          ))}
        </select>
      </ControlField>

      <ControlField label="1/2/3" title="Network degree — 1 know well, 2 intro'd by a 1, 3 by a 2">
        <select
          className={SELECT_CLS}
          value={degree}
          disabled={pending}
          onChange={(e) => {
            const prev = degree;
            const next = e.target.value;
            setDegree(next);
            commit(
              () =>
                setNetworkDegree(
                  person.id,
                  next ? (Number(next) as NetworkDegree) : null
                ),
              () => setDegree(prev)
            );
          }}
        >
          <option value="">—</option>
          {NETWORK_DEGREES.map((d) => (
            <option key={d} value={String(d)} title={NETWORK_DEGREE_LABELS[d]}>
              {d}
            </option>
          ))}
        </select>
      </ControlField>

      <ControlField label="Intent">
        <select
          className={SELECT_CLS}
          value={intent}
          disabled={pending}
          onChange={(e) => {
            const prev = intent;
            const next = e.target.value;
            setIntentVal(next);
            commit(
              () =>
                setContactIntent(
                  person.id,
                  (next || null) as ContactIntent | null
                ),
              () => setIntentVal(prev)
            );
          }}
        >
          <option value="">Auto</option>
          {CONTACT_INTENTS.map((i) => (
            <option key={i} value={i}>
              {CONTACT_INTENT_LABELS[i]}
            </option>
          ))}
        </select>
      </ControlField>

      <ControlField label="Cadence">
        <select
          className={SELECT_CLS}
          value={cadence}
          disabled={pending}
          onChange={(e) => {
            const prev = cadence;
            const next = e.target.value;
            setCadenceVal(next);
            commit(
              () => setCadence(person.id, next as CadenceInterval),
              () => setCadenceVal(prev)
            );
          }}
        >
          {CADENCE_INTERVALS.map((c) => (
            <option key={c} value={c}>
              {CADENCE_LABELS[c]}
            </option>
          ))}
        </select>
      </ControlField>

      <ControlField label="Classification">
        <select
          className={SELECT_CLS}
          value={rel}
          disabled={pending}
          onChange={(e) => {
            const prev = rel;
            const next = e.target.value;
            setRel(next);
            commit(
              () =>
                setRelationshipType(
                  person.id,
                  (next || null) as RelationshipType | null
                ),
              () => setRel(prev)
            );
          }}
        >
          <option value="">Unclassified</option>
          {RELATIONSHIP_TYPES.map((t) => (
            <option key={t} value={t}>
              {RELATIONSHIP_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </ControlField>
    </div>
  );
}

function scheduleIsPast(person: OutreachPerson): boolean {
  return Boolean(person.next_touch_date && person.next_touch_date <= todayISO());
}

function scheduleHint(person: OutreachPerson): string {
  if (person.next_touch_date) {
    const past = person.next_touch_date <= todayISO();
    return `${past ? "due" : "next"} ${fmtRelative(person.next_touch_date)}`;
  }
  if (person.last_touch_date) return `last touch ${fmtRelative(person.last_touch_date)}`;
  return "no schedule";
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
