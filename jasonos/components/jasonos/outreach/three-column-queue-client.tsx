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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { OutreachModal } from "@/components/jasonos/outreach/outreach-modal";
import { ContactCreateModal } from "@/components/jasonos/outreach/contact-create-modal";
import { TierDegreeBadge } from "@/components/jasonos/outreach/tier-degree-badge";
import { ReplyStatusLight } from "@/components/jasonos/outreach/reply-status-light";
import { RELATIONSHIP_TYPE_LABELS } from "@/lib/outreach/types";
import type { OutreachPerson } from "@/lib/outreach/data";
import type { QueueCard, QueueColumnKey, ThreeColumnQueue } from "@/lib/outreach/queue-buckets";
import type {
  CommChannel,
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
    key: "network_growth",
    title: "Network Growth",
    helper: "building / deepening",
    icon: Sparkles,
    accent: "text-amber-300",
    stripe: "from-amber-500/15",
  },
  {
    key: "network_maintenance",
    title: "Network Maintenance",
    helper: "keep warm",
    icon: Flame,
    accent: "text-rose-300",
    stripe: "from-rose-500/15",
  },
  {
    key: "browning_cold",
    title: "Cold",
    helper: "cold outreach",
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
    helper: "Past next-touch date",
    icon: AlertCircle,
    textColor: "text-red-300",
    headerBg: "bg-red-700/80",
    defaultCollapsed: false,
  },
  {
    key: "due_this_week",
    label: "Due This Week",
    helper: "Due today or by the end of this week (Fri)",
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
];

// Rendered as a single full-width section at the very bottom of the page
// (not repeated per column) — contacts with no next-touch date that still
// need classification and/or a cadence.
const NEEDS_ATTENTION_BAND: BandDef = {
  key: "needs_scheduling",
  label: "Needs to be Classified & Scheduled",
  helper: "No next-touch date set — classify and set a cadence to activate",
  icon: HelpCircle,
  textColor: "text-muted-foreground",
  headerBg: "bg-muted/60",
  defaultCollapsed: false,
};

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
  // Eastern calendar day, matching how touches are stamped, so "engaged today"
  // reflects Jason's day regardless of the browser's timezone.
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

// End of the current calendar work week (the coming Friday, inclusive) as a
// YYYY-MM-DD string. "This week" runs through this Friday; later rolls to next
// week ("Scheduled"). On a weekend, points to next Friday.
function endOfWorkWeekYMD(baseYmd: string): string {
  const d = new Date(`${baseYmd}T00:00:00Z`);
  const daysUntilFriday = (5 - d.getUTCDay() + 7) % 7; // Fri = 5
  d.setUTCDate(d.getUTCDate() + daysUntilFriday);
  return d.toISOString().split("T")[0];
}

/**
 * Status derivation for a queue card.
 *
 * Band placement is driven by the effective next-touch date on the card
 * (manual override or cadence-derived). Schedule's "sent today" signal still
 * wins for Engaged Today. Other CommUrgency values are only a fallback when
 * the card has no next-touch of its own.
 */
function deriveCardUrgency(
  card: QueueCard,
  comm: CommunicationsContact | undefined
): QueueUrgencyKey {
  const today = todayYMD();
  if (comm?.urgency === "sent_today") return "engaged_today";
  if (card.last_touch_date && card.last_touch_date.slice(0, 10) === today) {
    return "engaged_today";
  }

  const nextTouch = card.next_touch_date ?? comm?.nextActionDueDate ?? null;
  if (nextTouch) {
    if (nextTouch < today) return "overdue";
    if (nextTouch <= endOfWorkWeekYMD(today)) return "due_this_week";
    return "scheduled";
  }

  if (comm?.urgency) return fromCommUrgency(comm.urgency);
  return "needs_scheduling";
}

type BandCells = Record<QueueUrgencyKey, Record<QueueColumnKey, QueueCard[]>>;

function emptyBandCells(): BandCells {
  return {
    engaged_today: { network_growth: [], network_maintenance: [], browning_cold: [] },
    overdue: { network_growth: [], network_maintenance: [], browning_cold: [] },
    due_this_week: { network_growth: [], network_maintenance: [], browning_cold: [] },
    scheduled: { network_growth: [], network_maintenance: [], browning_cold: [] },
    needs_scheduling: { network_growth: [], network_maintenance: [], browning_cold: [] },
  };
}

// Synthesize a queue card from a raw contact so unclassified people (no intent,
// no cadence, no touch/recruiter signal — e.g. a fresh spreadsheet import) can
// surface in the bottom "Needs to be Classified & Scheduled" inbox.
function personToCard(p: OutreachPerson): QueueCard {
  const column: QueueColumnKey =
    p.intent === "network_growth"
      ? "network_growth"
      : p.intent === "browning_cold"
      ? "browning_cold"
      : "network_maintenance";
  return {
    key: `person-${p.id}`,
    column,
    name: p.name,
    title: p.title,
    firm: p.firm,
    vip: p.vip,
    relationship_type: p.relationship_type,
    relevance_tier: p.relevance_tier,
    network_degree: p.network_degree,
    primary_email: p.primary_email,
    linkedin_url: p.linkedin_url,
    cadence_interval: p.cadence_interval,
    cadence_stage: p.cadence_stage,
    next_touch_date: p.next_touch_date,
    last_touch_date: p.last_touch_date,
    reply_status_override: p.reply_status_override,
    reply_status_override_at: p.reply_status_override_at,
    reason: "Needs classification & scheduling",
    sequenceStageLabel: null,
    contactId: p.id,
    recruiterId: null,
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

  // Schedule contacts indexed by jasonos.contacts.id — recruiter-linked
  // Schedule rows use rr_recruiters.id as `id`, so prefer `contactId`.
  const commByContactId = useMemo(() => {
    const map = new Map<string, CommunicationsContact>();
    for (const c of scheduleContacts) {
      map.set(c.contactId || c.id, c);
      if (c.contactId && c.contactId !== c.id) map.set(c.id, c);
    }
    return map;
  }, [scheduleContacts]);

  // Union population: every queue card, PLUS every Schedule contact that has
  // no queue card yet (so the grid shows the exact same contact set as the
  // Schedule page). A contact with an explicit intent is already carded by
  // getThreeColumnQueue; anything left here is unclassified but has a
  // next-touch date, so we surface it in the SPECIFIC column (in its correct
  // urgency zone) without stamping an intent — it stays honestly unclassified.
  const columns = useMemo(() => {
    const seen = new Set<string>();
    const result: Record<QueueColumnKey, QueueCard[]> = {
      network_growth: [...buckets.network_growth],
      network_maintenance: [...buckets.network_maintenance],
      browning_cold: [...buckets.browning_cold],
    };
    for (const colKey of [
      "network_growth",
      "network_maintenance",
      "browning_cold",
    ] as const) {
      for (const card of result[colKey]) {
        if (card.contactId) seen.add(card.contactId);
      }
    }
    for (const cc of scheduleContacts) {
      if (seen.has(cc.id)) continue;
      const person = peopleById.get(cc.id);
      // Respect a pinned intent if somehow present; otherwise (unclassified
      // but scheduled) park the contact in Specific.
      const column: QueueColumnKey =
        person?.intent === "network_maintenance" ||
        person?.intent === "browning_cold"
          ? person.intent
          : "network_growth";
      result[column].push({
        key: `sched-${cc.id}`,
        column,
        name: cc.name,
        title: cc.title,
        firm: cc.firm,
        vip: person?.vip ?? false,
        relationship_type: person?.relationship_type ?? null,
        relevance_tier: person?.relevance_tier ?? null,
        network_degree: person?.network_degree ?? null,
        primary_email: person?.primary_email ?? null,
        linkedin_url: person?.linkedin_url ?? null,
        cadence_interval: person?.cadence_interval ?? "none",
        cadence_stage: person?.cadence_stage ?? null,
        // Prefer the contact's next_touch_date (manual override or cadence)
        // over a possibly-stale pipeline due date on the Schedule row.
        next_touch_date: person?.next_touch_date ?? cc.nextActionDueDate,
        last_touch_date:
          person?.last_touch_date ??
          cc.lastTouch?.touched_at?.slice(0, 10) ??
          null,
        reply_status_override: person?.reply_status_override ?? null,
        reply_status_override_at: person?.reply_status_override_at ?? null,
        reason: "Scheduled touch",
        sequenceStageLabel: null,
        contactId: cc.contactId || cc.id,
        recruiterId: cc.source === "recruiter" ? cc.id : null,
      });
    }
    return result;
  }, [buckets, scheduleContacts, peopleById]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return columns;
    const fn = (cards: QueueCard[]) =>
      cards.filter((c) => {
        const name = c.name.toLowerCase();
        const firm = (c.firm ?? "").toLowerCase();
        return name.includes(q) || firm.includes(q);
      });
    return {
      network_growth: fn(columns.network_growth),
      network_maintenance: fn(columns.network_maintenance),
      browning_cold: fn(columns.browning_cold),
    };
  }, [searchQuery, columns]);

  const counts = {
    network_growth: filtered.network_growth.length,
    network_maintenance: filtered.network_maintenance.length,
    browning_cold: filtered.browning_cold.length,
  };

  const bandCells = useMemo(() => {
    const cells = emptyBandCells();
    for (const colKey of [
      "network_growth",
      "network_maintenance",
      "browning_cold",
    ] as const) {
      for (const card of filtered[colKey]) {
        const urgency = deriveCardUrgency(
          card,
          card.contactId ? commByContactId.get(card.contactId) : undefined
        );
        cells[urgency][colKey].push(card);
      }
    }
    // Match the Schedule page's default "Priority score" ordering within
    // each bucket (strength desc, then name) — EXCEPT the "scheduled" band,
    // which reads best in chronological (next-touch date) order.
    const strengthOf = (card: QueueCard) =>
      (card.contactId ? commByContactId.get(card.contactId)?.strength : 0) ?? 0;
    const nextDateOf = (card: QueueCard) =>
      card.next_touch_date ??
      (card.contactId
        ? commByContactId.get(card.contactId)?.nextActionDueDate
        : null) ??
      null;
    for (const [bandKey, band] of Object.entries(cells)) {
      for (const list of Object.values(band)) {
        if (bandKey === "scheduled") {
          list.sort((a, b) => {
            const ad = nextDateOf(a);
            const bd = nextDateOf(b);
            if (ad && bd) {
              if (ad !== bd) return ad < bd ? -1 : 1; // soonest first
            } else if (ad) return -1;
            else if (bd) return 1;
            return a.name.localeCompare(b.name);
          });
        } else {
          list.sort(
            (a, b) => strengthOf(b) - strengthOf(a) || a.name.localeCompare(b.name)
          );
        }
      }
    }
    return cells;
  }, [filtered, commByContactId]);

  // Bottom-of-page inbox: contacts that still need classification and/or
  // scheduling. Two sources, deduped by contact id:
  //   1) Classified cards already in a column whose status is needs_scheduling
  //      (they have an intent but no next-touch date yet).
  //   2) Every other non-backrow contact that isn't represented in any column
  //      at all — i.e. unclassified people (no intent / cadence / signal), such
  //      as a freshly imported list. These drop out of this inbox the moment
  //      they're given an intent (which lands them in a column).
  const needsAttention = useMemo(() => {
    const strengthOf = (card: QueueCard) =>
      (card.contactId ? commByContactId.get(card.contactId)?.strength : 0) ?? 0;

    const fromColumns = [
      ...bandCells.needs_scheduling.network_growth,
      ...bandCells.needs_scheduling.network_maintenance,
      ...bandCells.needs_scheduling.browning_cold,
    ];

    const cardedIds = new Set<string>();
    for (const colKey of [
      "network_growth",
      "network_maintenance",
      "browning_cold",
    ] as const) {
      for (const c of columns[colKey]) if (c.contactId) cardedIds.add(c.contactId);
    }

    const q = searchQuery.trim().toLowerCase();
    const unplaced = buckets.outreachPeople
      .filter((p) => p.intent !== "backrow" && !cardedIds.has(p.id))
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          (p.firm ?? "").toLowerCase().includes(q)
      )
      .map(personToCard);

    const seen = new Set(
      fromColumns
        .map((c) => c.contactId)
        .filter((id): id is string => Boolean(id))
    );
    const merged = [...fromColumns];
    for (const c of unplaced) {
      if (c.contactId && seen.has(c.contactId)) continue;
      merged.push(c);
    }

    return merged.sort(
      (a, b) => strengthOf(b) - strengthOf(a) || a.name.localeCompare(b.name)
    );
  }, [bandCells, columns, buckets.outreachPeople, searchQuery, commByContactId]);

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
          network_growth={counts.network_growth}
          network_maintenance={counts.network_maintenance}
          browning_cold={counts.browning_cold}
        />
      </div>

      {buckets.caveats.length ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200/90">
          <strong className="font-semibold">Heads up:</strong>{" "}
          {buckets.caveats.join(" · ")}
        </div>
      ) : null}

      {/* Three vertical intent columns, each repeating the colored urgency
          section headers from the Schedule page's Outreach Grid. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => (
          <QueueColumn
            key={col.key}
            def={col}
            count={counts[col.key]}
            bandCells={bandCells}
            commByContactId={commByContactId}
            onCardClick={onCardClick}
          />
        ))}
      </div>

      {/* Needs to be Classified & Scheduled — full width, very bottom */}
      <section className="overflow-hidden rounded-xl border">
        <ColumnUrgencySection
          def={NEEDS_ATTENTION_BAND}
          cards={needsAttention}
          commByContactId={commByContactId}
          onCardClick={onCardClick}
          showRelationship
          listMaxHeightClass="max-h-96"
        />
      </section>

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
// Queue column — a vertical Warm/Specific/Cold column that repeats the
// Schedule page Outreach Grid's colored urgency section headers inside it.
// ---------------------------------------------------------------------------

function QueueColumn({
  def,
  count,
  bandCells,
  commByContactId,
  onCardClick,
}: {
  def: ColumnDef;
  count: number;
  bandCells: BandCells;
  commByContactId: Map<string, CommunicationsContact>;
  onCardClick: (card: QueueCard) => void;
}) {
  const Icon = def.icon;
  return (
    <section className="flex flex-col overflow-hidden rounded-xl border bg-card/40">
      <header
        className={cn(
          "flex items-center gap-2 border-b bg-gradient-to-b px-3 py-2.5",
          def.stripe,
          "to-transparent"
        )}
      >
        <Icon className={cn("h-4 w-4", def.accent)} />
        <h2 className="text-sm font-semibold tracking-tight">{def.title}</h2>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          · {count} · {def.helper}
        </span>
      </header>
      <div className="flex flex-col">
        {BANDS.map((band) => (
          <ColumnUrgencySection
            key={band.key}
            def={band}
            cards={bandCells[band.key][def.key]}
            commByContactId={commByContactId}
            onCardClick={onCardClick}
          />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Urgency section within a column — collapsible colored header + vertically
// scrolling contact rows, matching the Schedule page's Outreach Grid.
// ---------------------------------------------------------------------------

function ColumnUrgencySection({
  def,
  cards,
  commByContactId,
  onCardClick,
  showColumn = false,
  showRelationship = false,
  listMaxHeightClass = "max-h-48",
}: {
  def: BandDef;
  cards: QueueCard[];
  commByContactId: Map<string, CommunicationsContact>;
  onCardClick: (card: QueueCard) => void;
  /** Show each row's Warm/Specific/Cold tag (used by the bottom bucket). */
  showColumn?: boolean;
  /** Show each row's relationship type (used by the unclassified inbox). */
  showRelationship?: boolean;
  listMaxHeightClass?: string;
}) {
  const [collapsed, setCollapsed] = useState(def.defaultCollapsed);
  const Icon = def.icon;

  return (
    <div className="border-b last:border-b-0">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between gap-3 px-3 py-2 text-left",
          def.headerBg
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Icon className={cn("h-3.5 w-3.5 shrink-0", def.textColor)} />
          <div className="min-w-0">
            <div className={cn("text-xs font-semibold", def.textColor)}>
              {def.label}
            </div>
            <div className="truncate text-[10px] text-white/60">
              {def.helper}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {cards.length > 0 ? (
            <span className="text-xs font-medium text-white/80">
              {cards.length}
            </span>
          ) : null}
          {collapsed ? (
            <ChevronDown className="h-4 w-4 text-white/60" />
          ) : (
            <ChevronUp className="h-4 w-4 text-white/60" />
          )}
        </div>
      </button>

      {!collapsed ? (
        cards.length === 0 ? (
          <div className="px-3 py-2.5 text-xs italic text-muted-foreground">
            No contacts in this bucket
          </div>
        ) : (
          <div
            className={cn(
              "divide-y divide-border/30 overflow-y-auto bg-card/10",
              listMaxHeightClass
            )}
          >
            {cards.map((c) => (
              <BandContactRow
                key={c.key}
                card={c}
                comm={
                  c.contactId ? commByContactId.get(c.contactId) ?? null : null
                }
                onOpen={onCardClick}
                showColumn={showColumn}
                showRelationship={showRelationship}
              />
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Band contact row — the Schedule page Outreach Grid's compact contact row.
// Name + firm on the left; next-touch date (or last touch) + strength dots
// on the right. Vertically scrollable inside each band cell.
// ---------------------------------------------------------------------------

const COLUMN_TAG_COLORS: Record<QueueColumnKey, string> = {
  network_growth: "text-amber-300",
  network_maintenance: "text-rose-300",
  browning_cold: "text-sky-300",
};

function BandContactRow({
  card,
  comm,
  onOpen,
  showColumn = false,
  showRelationship = false,
}: {
  card: QueueCard;
  comm: CommunicationsContact | null;
  onOpen: (card: QueueCard) => void;
  showColumn?: boolean;
  showRelationship?: boolean;
}) {
  const nextDate = comm?.nextActionDueDate ?? card.next_touch_date;
  const lastTouch = comm?.lastTouch ?? null;
  const lastDate = lastTouch?.touched_at ?? card.last_touch_date;

  return (
    <button
      type="button"
      onClick={() => onOpen(card)}
      className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/30"
    >
      <div className="min-w-0 flex-1">
        {showColumn ? (
          <span
            className={cn(
              "mr-1.5 text-[9px] font-semibold uppercase tracking-wider",
              COLUMN_TAG_COLORS[card.column]
            )}
          >
            {card.column}
          </span>
        ) : null}
        {showRelationship ? (
          <span className="mr-1.5 rounded-full border border-border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
            {card.relationship_type
              ? RELATIONSHIP_TYPE_LABELS[card.relationship_type]
              : "Unclassified"}
          </span>
        ) : null}
        <span className="truncate text-xs font-medium">{card.name}</span>
        {card.relevance_tier || card.network_degree ? (
          <TierDegreeBadge
            tier={card.relevance_tier}
            degree={card.network_degree}
            className="ml-1.5 align-middle"
          />
        ) : null}
        {card.firm ? (
          <span className="ml-1.5 text-[10px] text-muted-foreground">
            · {card.firm}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {nextDate ? (
          <span className="text-[10px] text-sky-400">{fmtDate(nextDate)}</span>
        ) : lastTouch ? (
          <span className="text-[10px] text-muted-foreground">
            {CHANNEL_LABELS[lastTouch.channel]} · {fmtDate(lastTouch.touched_at)}
          </span>
        ) : lastDate ? (
          <span className="text-[10px] text-muted-foreground">
            {fmtDate(lastDate)}
          </span>
        ) : null}
        <ReplyStatusLight
          lastTouch={comm?.lastTouch ?? null}
          override={card.reply_status_override}
          overrideAt={card.reply_status_override_at}
        />
      </div>
    </button>
  );
}

const CHANNEL_LABELS: Record<CommChannel, string> = {
  email: "Email",
  linkedin: "LinkedIn",
  phone: "Phone",
  meeting: "Meeting",
  other: "Other",
};

function fmtDate(iso: string): string {
  try {
    // Date-only strings (YYYY-MM-DD, e.g. next_touch_date) must be parsed as
    // LOCAL time. `new Date("2026-07-16")` is UTC midnight, which renders a day
    // early in negative-UTC timezones — the source of the queue/card mismatch.
    // Full ISO timestamps (touched_at) carry a zone and render as-is.
    const d = /^\d{4}-\d{2}-\d{2}$/.test(iso)
      ? new Date(`${iso}T00:00:00`)
      : new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Summary strip — replaces the legacy multi-line stats block.
// ---------------------------------------------------------------------------

function ReconnectSummaryStrip({
  network_growth,
  network_maintenance,
  browning_cold,
}: {
  network_growth: number;
  network_maintenance: number;
  browning_cold: number;
}) {
  return (
    <p className="text-[11px] text-muted-foreground">
      <span className="font-medium text-amber-300">{network_growth}</span> growth ·{" "}
      <span className="font-medium text-rose-300">{network_maintenance}</span>{" "}
      maintenance ·{" "}
      <span className="font-medium text-sky-300">{browning_cold}</span> Cold
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
