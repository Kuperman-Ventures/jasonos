"use client";

// Three-Column Outreach Queue (Warm / Specific / Cold).
//
// Replaces the legacy ReconnectClient body for /outreach/queue. The three
// columns are pre-bucketed server-side (lib/outreach/queue-buckets.ts) so
// this component is purely presentational + filtering: search-by-name/firm
// across all three columns, and click-through into the existing
// OutreachModal for any card.
//
// We deliberately do NOT implement drag-and-drop. Column transitions are
// driven by data — logging a touch, advancing a sequence, or replying — and
// flow through the existing modal + server actions.

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Flame,
  HelpCircle,
  Mail,
  Plus,
  Radar,
  Search,
  Snowflake,
  Sparkles,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { OutreachModal } from "@/components/jasonos/outreach/outreach-modal";
import { ContactCreateModal } from "@/components/jasonos/outreach/contact-create-modal";
import { RelationshipBadge } from "@/components/jasonos/outreach/relationship-badge";
import type { OutreachPerson } from "@/lib/outreach/data";
import type { QueueCard, QueueColumnKey, ThreeColumnQueue } from "@/lib/outreach/queue-buckets";
import type {
  CommunicationsContact,
  CommUrgency,
} from "@/lib/server-actions/communications";
import type { ReconnectContact, RecruiterStatus } from "@/lib/reconnect/types";
import type { Intent } from "@/lib/triage/types";
import type { FirstContactState } from "@/lib/first-contact/types";

interface ThreeColumnQueueClientProps {
  buckets: ThreeColumnQueue;
  triageCount: number;
  scheduleContacts: CommunicationsContact[];
}

interface ColumnDef {
  key: QueueColumnKey;
  title: string;
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  stripe: string;
}

const COLUMNS: ColumnDef[] = [
  {
    key: "warm",
    title: "Warm",
    helper: "this week",
    icon: Flame,
    accent: "text-rose-300",
    stripe: "from-rose-500/15",
  },
  {
    key: "specific",
    title: "Specific",
    helper: "pending follow-up",
    icon: Sparkles,
    accent: "text-amber-300",
    stripe: "from-amber-500/15",
  },
  {
    key: "cold",
    title: "Cold",
    helper: "in progress",
    icon: Snowflake,
    accent: "text-sky-300",
    stripe: "from-sky-500/15",
  },
];

// ---------------------------------------------------------------------------
// Urgency bands — the Schedule page's Outreach Grid statuses, rendered as
// horizontal rows that cut across all three intent columns. Each queue card
// lands at the intersection of its status band and its Warm/Specific/Cold
// column.
// ---------------------------------------------------------------------------

type QueueUrgencyKey =
  | "engaged_today"
  | "overdue"
  | "due_this_week"
  | "scheduled"
  | "needs_scheduling";

interface BandDef {
  key: QueueUrgencyKey;
  label: string;
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
  textColor: string;
  headerBg: string;
  defaultCollapsed: boolean;
}

const BANDS: BandDef[] = [
  {
    key: "engaged_today",
    label: "Engaged Today",
    helper: "Outbound touches recorded today",
    icon: Mail,
    textColor: "text-emerald-300",
    headerBg: "bg-emerald-700/70",
    defaultCollapsed: false,
  },
  {
    key: "overdue",
    label: "Overdue",
    helper: "Due today or past next-touch date",
    icon: AlertCircle,
    textColor: "text-red-300",
    headerBg: "bg-red-700/80",
    defaultCollapsed: false,
  },
  {
    key: "due_this_week",
    label: "Due This Week",
    helper: "Scheduled for outreach in the next 7 days",
    icon: Clock,
    textColor: "text-amber-300",
    headerBg: "bg-amber-600/70",
    defaultCollapsed: false,
  },
  {
    key: "scheduled",
    label: "Scheduled",
    helper: "Next touch set after this week",
    icon: Calendar,
    textColor: "text-sky-300",
    headerBg: "bg-sky-800/50",
    defaultCollapsed: false,
  },
  {
    key: "needs_scheduling",
    label: "Needs Scheduling",
    helper: "No next-touch date set — set a cadence to activate",
    icon: HelpCircle,
    textColor: "text-muted-foreground",
    headerBg: "bg-muted/60",
    defaultCollapsed: true,
  },
];

function fromCommUrgency(urgency: CommUrgency): QueueUrgencyKey {
  switch (urgency) {
    case "sent_today":
      return "engaged_today";
    case "due_today":
      return "overdue";
    case "this_week":
      return "due_this_week";
    case "scheduled":
      return "scheduled";
    case "needs_scheduling":
      return "needs_scheduling";
  }
}

function todayYMD(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

function addDaysYMD(base: string, days: number): string {
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

/**
 * Status derivation for a queue card. Prefers the Schedule page's
 * urgency (which accounts for synced sent-today touches and recruiter
 * pipeline due dates); falls back to the card's own dates so cards
 * without a Schedule row still land in a band.
 */
function deriveCardUrgency(
  card: QueueCard,
  commUrgency: CommUrgency | undefined
): QueueUrgencyKey {
  if (commUrgency) return fromCommUrgency(commUrgency);

  const today = todayYMD();
  if (card.last_touch_date && card.last_touch_date.slice(0, 10) === today) {
    return "engaged_today";
  }
  if (card.next_touch_date) {
    if (card.next_touch_date <= today) return "overdue";
    if (card.next_touch_date <= addDaysYMD(today, 7)) return "due_this_week";
    return "scheduled";
  }
  return "needs_scheduling";
}

type BandCells = Record<QueueUrgencyKey, Record<QueueColumnKey, QueueCard[]>>;

function emptyBandCells(): BandCells {
  return {
    engaged_today: { warm: [], specific: [], cold: [] },
    overdue: { warm: [], specific: [], cold: [] },
    due_this_week: { warm: [], specific: [], cold: [] },
    scheduled: { warm: [], specific: [], cold: [] },
    needs_scheduling: { warm: [], specific: [], cold: [] },
  };
}

export function ThreeColumnQueueClient({
  buckets,
  triageCount,
  scheduleContacts,
}: ThreeColumnQueueClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [openContext, setOpenContext] = useState<OpenContext | null>(null);
  const [addContactOpen, setAddContactOpen] = useState(false);
  // Local-state mirrors so logging touches / advancing the sequence inside the
  // modal updates the cards optimistically without a full server round-trip.
  // The full re-fetch happens on router.refresh() inside the modal callbacks.
  const [reconnectContacts, setReconnectContacts] = useState(
    buckets.reconnectContacts
  );

  const peopleById = useMemo(() => {
    const map = new Map<string, OutreachPerson>();
    for (const p of buckets.outreachPeople) map.set(p.id, p);
    return map;
  }, [buckets.outreachPeople]);

  const reconnectByRecruiterId = useMemo(() => {
    const map = new Map<string, ReconnectContact>();
    for (const r of reconnectContacts) map.set(r.id, r);
    return map;
  }, [reconnectContacts]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return {
        warm: buckets.warm,
        specific: buckets.specific,
        cold: buckets.cold,
      };
    }
    const fn = (cards: QueueCard[]) =>
      cards.filter((c) => {
        const name = c.name.toLowerCase();
        const firm = (c.firm ?? "").toLowerCase();
        return name.includes(q) || firm.includes(q);
      });
    return {
      warm: fn(buckets.warm),
      specific: fn(buckets.specific),
      cold: fn(buckets.cold),
    };
  }, [searchQuery, buckets]);

  const counts = {
    warm: filtered.warm.length,
    specific: filtered.specific.length,
    cold: filtered.cold.length,
  };

  // Schedule-page urgency per contact id — drives which band each card
  // lands in so the buckets behave the same way they do on /outreach/schedule.
  const urgencyByContactId = useMemo(() => {
    const map = new Map<string, CommUrgency>();
    for (const c of scheduleContacts) map.set(c.id, c.urgency);
    return map;
  }, [scheduleContacts]);

  const bandCells = useMemo(() => {
    const cells = emptyBandCells();
    for (const colKey of ["warm", "specific", "cold"] as const) {
      for (const card of filtered[colKey]) {
        const urgency = deriveCardUrgency(
          card,
          card.contactId ? urgencyByContactId.get(card.contactId) : undefined
        );
        cells[urgency][colKey].push(card);
      }
    }
    return cells;
  }, [filtered, urgencyByContactId]);

  const onCardClick = (card: QueueCard) => {
    const reconnect = card.recruiterId
      ? reconnectByRecruiterId.get(card.recruiterId) ?? null
      : null;
    const person = card.contactId ? peopleById.get(card.contactId) ?? null : null;
    setOpenContext({ card, person, reconnect });
  };

  // Local-state helpers mirroring ReconnectClient. They keep the modal's
  // optimistic UI working when a recruiter card is open.
  const setRecruiterStatus = (
    id: string,
    status: RecruiterStatus,
    note?: string
  ) => {
    setReconnectContacts((current) =>
      current.map((contact) => {
        if (contact.id !== id) return contact;
        const now = new Date().toISOString();
        return {
          ...contact,
          last_contact_date:
            status === "sent" || status === "replied"
              ? now
              : contact.last_contact_date,
          state: {
            ...contact.state,
            status,
            updated_at: now,
            next_action_due_date:
              status === "snoozed"
                ? new Date(Date.now() + 7 * 86_400_000).toISOString()
                : contact.state.next_action_due_date,
          },
          notes: note
            ? [
                {
                  id: `local-note-${Date.now()}`,
                  recruiter_id: id,
                  body: note,
                  created_at: now,
                },
                ...contact.notes,
              ]
            : contact.notes,
        };
      })
    );
  };
  const addLocalNote = (id: string, body: string) => {
    setReconnectContacts((current) =>
      current.map((contact) =>
        contact.id === id
          ? {
              ...contact,
              notes: [
                {
                  id: `local-note-${Date.now()}`,
                  recruiter_id: id,
                  body,
                  created_at: new Date().toISOString(),
                },
                ...contact.notes,
              ],
            }
          : contact
      )
    );
  };
  const setLocalTriage = (
    id: string,
    intent: Intent | null,
    personalGoal: string | null
  ) => {
    setReconnectContacts((current) =>
      current.map((contact) =>
        contact.id === id
          ? { ...contact, intent, personal_goal: personalGoal }
          : contact
      )
    );
  };
  const setLocalReconnectCardSent = (id: string) => {
    setReconnectContacts((current) =>
      current.map((contact) =>
        contact.id === id
          ? { ...contact, has_open_reconnect_card: true }
          : contact
      )
    );
  };
  const setLocalFirstContact = (id: string, firstContact: FirstContactState) => {
    setReconnectContacts((current) =>
      current.map((contact) =>
        contact.id === id
          ? {
              ...contact,
              first_contact: firstContact,
              state: {
                ...contact.state,
                updated_at:
                  firstContact.history[firstContact.history.length - 1]?.at ??
                  new Date().toISOString(),
              },
            }
          : contact
      )
    );
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 px-4 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-orange-300">
            <Radar className="h-4 w-4" />
            Outreach
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Outreach Queue
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Status bands (Engaged Today, Overdue, Due This Week, Scheduled)
            cut across the three intent columns: Warm maintenance, Specific
            follow-ups, Cold outreach in flight. Cards move on data — log a
            touch, advance a sequence, get a reply.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setAddContactOpen(true)}>
            <Plus className="h-4 w-4" />
            Add contact
          </Button>
          <Button variant="default" render={<Link href="/runner/triage" />}>
            Triage queue
            <Badge variant="secondary" className="ml-1 h-5">
              {triageCount}
            </Badge>
          </Button>
          <Button variant="outline" render={<Link href="/reconnect/contacts" />}>
            Full pipeline
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name or firm…"
            className="h-9 pl-8"
          />
        </div>
        <ReconnectSummaryStrip
          warm={counts.warm}
          specific={counts.specific}
          cold={counts.cold}
        />
      </div>

      {buckets.caveats.length ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200/90">
          <strong className="font-semibold">Heads up:</strong>{" "}
          {buckets.caveats.join(" · ")}
        </div>
      ) : null}

      {/* Column headers — Warm / Specific / Cold, shared by every band */}
      <div className="hidden grid-cols-3 gap-3 md:grid">
        {COLUMNS.map((col) => {
          const Icon = col.icon;
          return (
            <div
              key={col.key}
              className={cn(
                "flex items-center gap-2 rounded-xl border bg-gradient-to-b px-3 py-2.5",
                col.stripe,
                "to-transparent"
              )}
            >
              <Icon className={cn("h-4 w-4", col.accent)} />
              <h2 className="text-sm font-semibold tracking-tight">
                {col.title}
              </h2>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                · {counts[col.key]} · {col.helper}
              </span>
            </div>
          );
        })}
      </div>

      {/* Urgency bands — each cuts across all three columns */}
      <div className="space-y-3">
        {BANDS.map((band) => (
          <UrgencyBand
            key={band.key}
            def={band}
            cells={bandCells[band.key]}
            onCardClick={onCardClick}
          />
        ))}
      </div>

      {openContext ? (
        <OutreachModal
          open={Boolean(openContext)}
          onOpenChange={(open) => {
            if (!open) setOpenContext(null);
          }}
          contactId={openContext.card?.contactId ?? undefined}
          recruiterId={openContext.card?.recruiterId ?? undefined}
          initialDisplay={modalDisplay(openContext)}
          recruiterPipeline={
            openContext.reconnect
              ? {
                  contact: openContext.reconnect,
                  contacts: reconnectContacts,
                  onLocalStatus: setRecruiterStatus,
                  onLocalNote: addLocalNote,
                  onLocalTriage: setLocalTriage,
                  onLocalReconnectCardSent: setLocalReconnectCardSent,
                  onLocalFirstContact: setLocalFirstContact,
                }
              : undefined
          }
        />
      ) : null}

      <ContactCreateModal
        open={addContactOpen}
        onOpenChange={setAddContactOpen}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Urgency band — a full-width status row spanning the three intent columns.
// Collapsible header matching the Schedule page's Outreach Grid sections.
// ---------------------------------------------------------------------------

function UrgencyBand({
  def,
  cells,
  onCardClick,
}: {
  def: BandDef;
  cells: Record<QueueColumnKey, QueueCard[]>;
  onCardClick: (card: QueueCard) => void;
}) {
  const [collapsed, setCollapsed] = useState(def.defaultCollapsed);
  const Icon = def.icon;
  const total = cells.warm.length + cells.specific.length + cells.cold.length;

  return (
    <section className="overflow-hidden rounded-xl border">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left",
          def.headerBg
        )}
      >
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", def.textColor)} />
          <div>
            <div className={cn("text-sm font-semibold", def.textColor)}>
              {def.label}
            </div>
            <div className="text-[11px] text-white/60">{def.helper}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs font-medium text-white/80">{total}</span>
          {collapsed ? (
            <ChevronDown className="h-4 w-4 text-white/60" />
          ) : (
            <ChevronUp className="h-4 w-4 text-white/60" />
          )}
        </div>
      </button>

      {!collapsed ? (
        <div className="grid grid-cols-1 gap-3 bg-card/30 p-3 md:grid-cols-3 md:divide-x md:divide-border/40">
          {COLUMNS.map((col) => (
            <div
              key={col.key}
              className="flex min-h-[3.5rem] flex-col gap-2 md:px-3 md:first:pl-0 md:last:pr-0"
            >
              {/* Mobile-only column label since the shared header row is hidden */}
              <div className="flex items-center gap-1.5 md:hidden">
                <col.icon className={cn("h-3 w-3", col.accent)} />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {col.title}
                </span>
              </div>
              {cells[col.key].length === 0 ? (
                <div className="grid flex-1 place-items-center rounded-lg border border-dashed border-border/40 px-3 py-3 text-center text-[11px] italic text-muted-foreground/60">
                  No {col.title.toLowerCase()} contacts
                </div>
              ) : (
                cells[col.key].map((c) => (
                  <QueueCardRow key={c.key} card={c} onOpen={onCardClick} />
                ))
              )}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Card row
// ---------------------------------------------------------------------------

function QueueCardRow({
  card,
  onOpen,
}: {
  card: QueueCard;
  onOpen: (card: QueueCard) => void;
}) {
  const subline = [card.title, card.firm].filter(Boolean).join(" · ");
  const dateLabel = renderDateLabel(card);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(card)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(card);
        }
      }}
      className="cursor-pointer rounded-lg border bg-card p-3 text-left transition-colors hover:border-orange-400/40 hover:bg-card/90 focus:border-orange-400/60 focus:outline-none"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {card.vip ? (
              <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
            ) : null}
            <span className="truncate text-sm font-medium">{card.name}</span>
            <RelationshipBadge type={card.relationship_type} />
          </div>
          {subline ? (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {subline}
            </p>
          ) : null}
        </div>
        {card.sequenceStageLabel ? (
          <span className="shrink-0 rounded-sm border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-sky-200">
            {card.sequenceStageLabel}
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="truncate">{card.reason}</span>
        {dateLabel ? (
          <span className="shrink-0 font-mono text-[10px]">{dateLabel}</span>
        ) : null}
      </div>
    </article>
  );
}

function renderDateLabel(card: QueueCard): string | null {
  if (card.column === "warm" && card.next_touch_date) {
    return formatRelative(card.next_touch_date, true);
  }
  if (card.column === "specific" && card.last_touch_date) {
    return `last ${formatRelative(card.last_touch_date, false)}`;
  }
  if (card.column === "cold" && card.last_touch_date) {
    return formatRelative(card.last_touch_date, false);
  }
  return null;
}

function formatRelative(value: string, withDuePrefix: boolean): string {
  // value may be either YYYY-MM-DD or full ISO.
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const target = new Date(isDateOnly ? `${value}T00:00:00` : value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round(
    (target.getTime() - today.getTime()) / 86_400_000
  );
  if (withDuePrefix) {
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return "today";
    if (days === 1) return "tomorrow";
    return `in ${days}d`;
  }
  if (days === 0) return "today";
  if (days === -1) return "yesterday";
  if (days < 0 && days >= -60) return `${Math.abs(days)}d ago`;
  if (days > 0 && days <= 14) return `in ${days}d`;
  return target.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Summary strip — replaces the legacy multi-line stats block.
// ---------------------------------------------------------------------------

function ReconnectSummaryStrip({
  warm,
  specific,
  cold,
}: {
  warm: number;
  specific: number;
  cold: number;
}) {
  return (
    <p className="text-[11px] text-muted-foreground">
      <span className="font-medium text-rose-300">{warm}</span> warm ·{" "}
      <span className="font-medium text-amber-300">{specific}</span> specific ·{" "}
      <span className="font-medium text-sky-300">{cold}</span> cold
    </p>
  );
}

// ---------------------------------------------------------------------------
// Modal payload helpers
// ---------------------------------------------------------------------------

interface OpenContext {
  card: QueueCard | null;
  person: OutreachPerson | null;
  reconnect: ReconnectContact | null;
}

function modalDisplay(ctx: OpenContext): {
  name: string;
  title?: string | null;
  firm?: string | null;
} {
  if (ctx.person) {
    return {
      name: ctx.person.name,
      title: ctx.person.title,
      firm: ctx.person.firm,
    };
  }
  if (ctx.reconnect) {
    return {
      name: ctx.reconnect.name,
      title: ctx.reconnect.title ?? null,
      firm: ctx.reconnect.firm ?? null,
    };
  }
  return {
    name: ctx.card?.name ?? "Unknown",
    title: ctx.card?.title ?? null,
    firm: ctx.card?.firm ?? null,
  };
}
