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
  ArrowRight,
  Flame,
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
import type { ReconnectContact, RecruiterStatus } from "@/lib/reconnect/types";
import type { Intent } from "@/lib/triage/types";
import type { FirstContactState } from "@/lib/first-contact/types";

interface ThreeColumnQueueClientProps {
  buckets: ThreeColumnQueue;
  triageCount: number;
}

interface ColumnDef {
  key: QueueColumnKey;
  title: string;
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
  emptyState: { title: string; body: string };
  accent: string;
  stripe: string;
}

const COLUMNS: ColumnDef[] = [
  {
    key: "warm",
    title: "Warm",
    helper: "this week",
    icon: Flame,
    emptyState: {
      title: "Nothing warm due this week",
      body: "Cadence is on track. Check back as touch dates roll in.",
    },
    accent: "text-rose-300",
    stripe: "from-rose-500/15",
  },
  {
    key: "specific",
    title: "Specific",
    helper: "pending follow-up",
    icon: Sparkles,
    emptyState: {
      title: "No active follow-ups",
      body: "Replies, outcomes, and live conversations land here.",
    },
    accent: "text-amber-300",
    stripe: "from-amber-500/15",
  },
  {
    key: "cold",
    title: "Cold",
    helper: "in progress",
    icon: Snowflake,
    emptyState: {
      title: "No cold outreach in flight",
      body: "Try + Add outreach target to start a new sequence.",
    },
    accent: "text-sky-300",
    stripe: "from-sky-500/15",
  },
];

export function ThreeColumnQueueClient({
  buckets,
  triageCount,
}: ThreeColumnQueueClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [openContext, setOpenContext] = useState<OpenContext | null>(null);
  const [addTargetOpen, setAddTargetOpen] = useState(false);
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

  // Add a freshly-created cold target to local state so it shows up in Cold
  // immediately without waiting on router.refresh().
  const addLocalColdTarget = (contact: ReconnectContact) => {
    setReconnectContacts((current) => [
      contact,
      ...current.filter((item) => item.id !== contact.id),
    ]);
    setOpenContext({ card: null, person: null, reconnect: contact });
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
            Three intent-based columns: Warm maintenance, Specific follow-ups,
            Cold outreach in flight. Cards move on data — log a touch, advance
            a sequence, get a reply.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setAddContactOpen(true)}>
            <Plus className="h-4 w-4" />
            Add contact
          </Button>
          <Button variant="outline" onClick={() => setAddTargetOpen(true)}>
            <Plus className="h-4 w-4" />
            Add outreach target
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => (
          <Column
            key={col.key}
            def={col}
            cards={filtered[col.key]}
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
          contact={modalContactPayload(openContext)}
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
        open={addTargetOpen}
        onOpenChange={setAddTargetOpen}
        defaultMode="outreach_target"
        onCreated={({ reconnectContact }) => {
          if (reconnectContact) addLocalColdTarget(reconnectContact);
        }}
      />
      <ContactCreateModal
        open={addContactOpen}
        onOpenChange={setAddContactOpen}
        defaultMode="contact"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column
// ---------------------------------------------------------------------------

function Column({
  def,
  cards,
  onCardClick,
}: {
  def: ColumnDef;
  cards: QueueCard[];
  onCardClick: (card: QueueCard) => void;
}) {
  const Icon = def.icon;
  return (
    <section className="flex min-h-[20rem] flex-col rounded-xl border bg-card/40">
      <header
        className={cn(
          "sticky top-0 z-10 flex items-center justify-between gap-2 rounded-t-xl border-b bg-gradient-to-b px-3 py-2.5 backdrop-blur",
          def.stripe,
          "to-transparent"
        )}
      >
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", def.accent)} />
          <h2 className="text-sm font-semibold tracking-tight">{def.title}</h2>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            · {cards.length} · {def.helper}
          </span>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-2 p-2">
        {cards.length === 0 ? (
          <EmptyState title={def.emptyState.title} body={def.emptyState.body} />
        ) : (
          cards.map((c) => (
            <QueueCardRow key={c.key} card={c} onOpen={onCardClick} />
          ))
        )}
      </div>
    </section>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid flex-1 place-items-center px-4 py-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-[20rem] text-xs text-muted-foreground">{body}</p>
    </div>
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

function modalContactPayload(ctx: OpenContext): {
  id: string;
  name: string;
  title?: string | null;
  firm?: string | null;
  primary_email?: string | null;
  linkedin_url?: string | null;
  vip: boolean;
  relationship_type: OutreachPerson["relationship_type"];
  cadence_interval: OutreachPerson["cadence_interval"];
  cadence_stage?: OutreachPerson["cadence_stage"];
  intent?: OutreachPerson["intent"];
  next_touch_date?: string | null;
  last_touch_date?: string | null;
} {
  if (ctx.person) {
    return {
      id: ctx.person.id,
      name: ctx.person.name,
      title: ctx.person.title,
      firm: ctx.person.firm,
      primary_email: ctx.person.primary_email,
      linkedin_url: ctx.person.linkedin_url,
      vip: ctx.person.vip,
      relationship_type: ctx.person.relationship_type,
      cadence_interval: ctx.person.cadence_interval,
      cadence_stage: ctx.person.cadence_stage,
      intent: ctx.person.intent,
      next_touch_date: ctx.person.next_touch_date,
      last_touch_date: ctx.person.last_touch_date,
    };
  }
  // Pure-recruiter (no jasonos.contacts row). The modal will resolve the
  // linked OutreachPerson internally via source_ids; we just need an id +
  // identity shim here, mirroring ReconnectClient's behavior.
  if (ctx.reconnect) {
    return {
      id: ctx.reconnect.id,
      name: ctx.reconnect.name,
      title: ctx.reconnect.title ?? null,
      firm: ctx.reconnect.firm ?? null,
      primary_email: null,
      linkedin_url: ctx.reconnect.linkedin_url ?? null,
      vip: false,
      relationship_type: "recruiter",
      cadence_interval: "none",
      cadence_stage: null,
      intent: null,
      next_touch_date: null,
      last_touch_date: ctx.reconnect.last_contact_date ?? null,
    };
  }
  // Should never happen — both card.contactId and recruiterId would be null.
  return {
    id: ctx.card?.key ?? "unknown",
    name: ctx.card?.name ?? "Unknown",
    title: null,
    firm: null,
    primary_email: null,
    linkedin_url: null,
    vip: false,
    relationship_type: null,
    cadence_interval: "none",
    cadence_stage: null,
    intent: null,
    next_touch_date: null,
    last_touch_date: null,
  };
}
