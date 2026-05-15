"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Plus, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AskDispatchButton } from "@/components/dispatch/AskDispatchButton";
import type { Intent } from "@/lib/triage/types";
import type {
  ReconnectContact,
  ReconnectDashboardData,
  ReconnectObjectType,
  ReconnectStats,
  ReconnectTypeCounts,
  RecruiterStatus,
} from "@/lib/reconnect/types";
import { getFunnelStage, type FunnelStage } from "@/lib/reconnect/priority";
import { isBench } from "@/lib/reconnect/firm-focus";
import { ReconnectQueueCard } from "./queue-card";
import { OutreachModal } from "@/components/jasonos/outreach/outreach-modal";
import { ContactCreateModal } from "@/components/jasonos/outreach/contact-create-modal";
import { PriorityOutreachStrip } from "./priority-outreach-strip";
import { ReconnectStatsStrip } from "./stats-strip";
import type { FirstContactState } from "@/lib/first-contact/types";

type IntentFilter = null | "triaged" | "untriaged" | "triaged_ready" | "anchors_only" | Intent;

const INTENT_PRIORITY: Record<Intent, number> = {
  pipeline: 0,
  door: 1,
  role_inquiry: 2,
  intel: 3,
  warm: 4,
};

const INTENT_FILTER_LABELS: Record<Intent, string> = {
  door: "Door",
  pipeline: "Pipeline",
  role_inquiry: "Role",
  intel: "Intel",
  warm: "Warm",
};

export function ReconnectClient({
  data,
  triageCount,
  typeCounts,
  initialIntentFilter = null,
}: {
  data: ReconnectDashboardData;
  triageCount: number;
  typeCounts: ReconnectTypeCounts;
  initialIntentFilter?: IntentFilter;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [contacts, setContacts] = useState(data.contacts);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [includeTier3, setIncludeTier3] = useState(false);
  const [selectedType, setSelectedType] = useState<ReconnectObjectType>("all");
  const [intentFilter, setIntentFilter] = useState<IntentFilter>(initialIntentFilter);
  const [funnelFilter, setFunnelFilter] = useState<FunnelStage | null>(null);
  const [addColdOpen, setAddColdOpen] = useState(false);

  useEffect(() => {
    if (!pathname) return;
    const params = new URLSearchParams();
    if (intentFilter === "anchors_only") params.set("focus", "anchors");
    else if (intentFilter === "triaged_ready") params.set("intent", "triaged_ready");
    router.replace(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
  }, [intentFilter, pathname, router]);

  const stats = useMemo(() => computeStats(contacts), [contacts]);
  const intentCounts = useMemo(() => computeIntentCounts(contacts), [contacts]);
  const sortedContacts = useMemo(
    () => [...contacts].sort(compareReconnectContacts),
    [contacts]
  );
  const typeFilteredContacts = useMemo(
    () =>
      selectedType === "all"
        ? sortedContacts
        : sortedContacts.filter((contact) => contact.reconnect_object_type === selectedType),
    [sortedContacts, selectedType]
  );
  const filteredContacts = useMemo(
    () => filterByFunnel(filterByIntent(typeFilteredContacts, intentFilter), funnelFilter),
    [typeFilteredContacts, intentFilter, funnelFilter]
  );
  const displayedContacts = useMemo(
    () => (funnelFilter ? filteredContacts : getQueue(filteredContacts, includeTier3)),
    [filteredContacts, funnelFilter, includeTier3]
  );
  const selected = selectedId ? contacts.find((c) => c.id === selectedId) ?? null : null;
  const selectedEmptyHint = getTypeEmptyHint(selectedType);

  const setStatus = (id: string, status: RecruiterStatus, note?: string) => {
    setContacts((current) =>
      current.map((contact) => {
        if (contact.id !== id) return contact;
        const now = new Date().toISOString();
        return {
          ...contact,
          last_contact_date:
            status === "sent" || status === "replied" ? now : contact.last_contact_date,
          state: {
            ...contact.state,
            status,
            updated_at: now,
            next_action_due_date:
              status === "snoozed"
                ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
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
          touches:
            status === "sent" || status === "replied"
              ? [
                  {
                    id: `local-touch-${Date.now()}`,
                    recruiter_id: id,
                    channel: "linkedin",
                    direction: status === "sent" ? "outbound" : "inbound",
                    body:
                      status === "sent"
                        ? "Marked sent from Reconnect queue."
                        : "Marked reply received from Reconnect queue.",
                    created_at: now,
                  },
                  ...contact.touches,
                ]
              : contact.touches,
        };
      })
    );
  };

  const addLocalNote = (id: string, body: string) => {
    setContacts((current) =>
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

  const setLocalTriage = (id: string, intent: Intent | null, personalGoal: string | null) => {
    setContacts((current) =>
      current.map((contact) =>
        contact.id === id
          ? {
              ...contact,
              intent,
              personal_goal: personalGoal,
            }
          : contact
      )
    );
  };

  const setLocalReconnectCardSent = (id: string) => {
    setContacts((current) =>
      current.map((contact) =>
        contact.id === id
          ? {
              ...contact,
              reconnect_object_type: "manual",
              has_open_reconnect_card: true,
            }
          : contact
      )
    );
  };

  const setLocalFirstContact = (id: string, firstContact: FirstContactState) => {
    setContacts((current) =>
      current.map((contact) =>
        contact.id === id
          ? {
              ...contact,
              first_contact: firstContact,
              state: {
                ...contact.state,
                status: statusFromFirstContact(firstContact.stage),
                updated_at:
                  firstContact.history[firstContact.history.length - 1]?.at ??
                  new Date().toISOString(),
              },
            }
          : contact
      )
    );
  };

  const addLocalColdTarget = (contact: ReconnectContact) => {
    setContacts((current) => [contact, ...current.filter((item) => item.id !== contact.id)]);
    setSelectedId(contact.id);
    setSelectedType("cold_target");
    setTimeout(() => {
      document
        .getElementById("first-contact-sequence")
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 100);
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
            Daily action list across every relationship — search, advisors,
            operators, prospects, personal. Not a CRM: this is the surface for
            the next best touch.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAddColdOpen(true)}>
            <Plus className="h-4 w-4" />
            Add outreach target
          </Button>
          <Button variant="default" render={<Link href="/runner/triage" />}>
            Triage queue
            <Badge variant="secondary" className="ml-1 h-5">
              {triageCount}
            </Badge>
          </Button>
          <AskDispatchButton
            requestType="pipeline_analysis"
            sourcePage="/reconnect"
            context={{
              total_roles: contacts.length,
              stage_distribution: getStageDistribution(contacts),
              stale_count: stats.awaitingResponse,
            }}
            label="Ask Dispatch"
          />
          <Button variant="outline" render={<Link href="/reconnect/contacts" />}>
            Full pipeline
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <IntentFilterChips
        selected={intentFilter}
        counts={intentCounts}
        onSelect={setIntentFilter}
      />

      <ReconnectStatsStrip
        stats={stats}
        onTriagedReadyClick={() =>
          setIntentFilter((current) => (current === "triaged_ready" ? null : "triaged_ready"))
        }
        triagedReadyActive={intentFilter === "triaged_ready"}
      />

      <PriorityOutreachStrip
        contacts={contacts}
        selectedStage={funnelFilter}
        onSelectStage={(stage) =>
          setFunnelFilter((current) => (current === stage ? null : stage))
        }
        onSelectContact={setSelectedId}
      />

      <TypeTabs
        selected={selectedType}
        counts={typeCounts}
        onSelect={setSelectedType}
      />

      <section className="rounded-xl border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Today&rsquo;s Queue</h2>
            <p className="text-xs text-muted-foreground">
              Tier 1 + 2 contacts in queue, ordered by strategic score and stale touch date.
            </p>
          </div>
          <Button
            variant={includeTier3 ? "default" : "outline"}
            size="sm"
            onClick={() => setIncludeTier3((v) => !v)}
          >
            Surface Tier 3
          </Button>
        </header>

        {filteredContacts.length === 0 ? (
          <div className="grid place-items-center px-4 py-16 text-center">
            <CheckCircle2 className="h-10 w-10 text-muted-foreground/60" />
            <h3 className="mt-3 text-lg font-semibold tracking-tight">
              No contacts match this Reconnect view.
            </h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {selectedType !== "all" ? selectedEmptyHint : "Clear the triage filter to see the full queue."}
            </p>
          </div>
        ) : displayedContacts.length ? (
          <div className="space-y-3 p-3">
            {displayedContacts.map((contact) => (
              <ReconnectQueueCard
                key={contact.id}
                contact={contact}
                onOpen={(c) => setSelectedId(c.id)}
                onStatus={setStatus}
              />
            ))}
          </div>
        ) : (
          <div className="grid place-items-center px-4 py-16 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            <h3 className="mt-3 text-lg font-semibold tracking-tight">
              You&rsquo;re caught up.
            </h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {funnelFilter
                ? "No priority contacts match this funnel stage."
                : "No Tier 1 or Tier 2 touches are due today. Pull Tier 3 forward if you want to widen the field."}
            </p>
            {!funnelFilter ? (
              <Button className="mt-4" onClick={() => setIncludeTier3(true)}>
                Surface TIER 3 contacts
              </Button>
            ) : null}
          </div>
        )}
      </section>

      {selected ? (
        <OutreachModal
          open={!!selected}
          onOpenChange={(open) => {
            if (!open) setSelectedId(null);
          }}
          contact={{
            id: selected.id,
            name: selected.name,
            title: selected.title ?? null,
            firm: selected.firm ?? null,
            primary_email: null,
            linkedin_url: selected.linkedin_url ?? null,
            vip: false,
            relationship_type: "recruiter",
            cadence_interval: "none",
            cadence_stage: null,
            next_touch_date: null,
            last_touch_date: selected.last_contact_date ?? null,
          }}
          recruiterPipeline={{
            contact: selected,
            contacts,
            onLocalStatus: setStatus,
            onLocalNote: addLocalNote,
            onLocalTriage: setLocalTriage,
            onLocalReconnectCardSent: setLocalReconnectCardSent,
            onLocalFirstContact: setLocalFirstContact,
          }}
        />
      ) : null}
      <ContactCreateModal
        open={addColdOpen}
        onOpenChange={setAddColdOpen}
        defaultMode="outreach_target"
        onCreated={({ reconnectContact }) => {
          if (reconnectContact) addLocalColdTarget(reconnectContact);
        }}
      />
    </div>
  );
}

function IntentFilterChips({
  selected,
  counts,
  onSelect,
}: {
  selected: IntentFilter;
  counts: IntentCounts;
  onSelect: (filter: IntentFilter) => void;
}) {
  const baseChips: Array<{ filter: IntentFilter; label: string; count: number }> = [
    { filter: null, label: "All", count: counts.total },
    { filter: "anchors_only", label: "Anchors only", count: counts.anchors },
    { filter: "triaged", label: "Triaged", count: counts.triaged },
    { filter: "untriaged", label: "Untriaged", count: counts.untriaged },
  ];
  const intentChips = (Object.keys(INTENT_PRIORITY) as Intent[])
    .filter((intent) => counts.byIntent[intent] > 0)
    .map((intent) => ({
      filter: intent,
      label: INTENT_FILTER_LABELS[intent],
      count: counts.byIntent[intent],
    }));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {baseChips.map((chip) => (
        <FilterChip
          key={chip.filter ?? "all"}
          active={selected === chip.filter}
          label={`${chip.label} (${chip.count})`}
          onClick={() => onSelect(chip.filter)}
        />
      ))}
      {intentChips.length ? <div className="mx-2 h-5 border-l" /> : null}
      {intentChips.map((chip) => (
        <FilterChip
          key={chip.filter}
          active={selected === chip.filter}
          label={`${chip.label} (${chip.count})`}
          onClick={() => onSelect(chip.filter)}
        />
      ))}
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-sm transition-colors ${
        active
          ? "bg-foreground text-background"
          : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function TypeTabs({
  selected,
  counts,
  onSelect,
}: {
  selected: ReconnectObjectType;
  counts: ReconnectTypeCounts;
  onSelect: (type: ReconnectObjectType) => void;
}) {
  const tabs: Array<{ type: ReconnectObjectType; label: string; count: number }> = [
    { type: "all", label: "All", count: counts.total },
    { type: "recruiter", label: "Recruiters", count: counts.by_type.recruiter ?? 0 },
    { type: "tier1_contact", label: "Tier 1", count: counts.by_type.tier1_contact ?? 0 },
    { type: "manual", label: "Manual", count: counts.by_type.manual ?? 0 },
    { type: "cold_target", label: "Outreach targets", count: counts.by_type.cold_target ?? 0 },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.type}
          type="button"
          onClick={() => onSelect(tab.type)}
          className={`rounded-full border px-3 py-1 text-sm transition-colors ${
            selected === tab.type
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          {tab.label} ({tab.count})
        </button>
      ))}
    </div>
  );
}

function getTypeEmptyHint(type: ReconnectObjectType) {
  switch (type) {
    case "tier1_contact":
      return "Run the Tier 1 Ranker on /contacts to populate this list.";
    case "manual":
      return "Click 'Send to Triage' on any contact to add them here.";
    case "cold_target":
      return "Click '+ Add outreach target' to start a First Contact sequence.";
    case "recruiter":
      return "Recruiter cards will appear here when they are open in Reconnect.";
    case "all":
      return "Reconnect cards will appear here when they are open.";
  }
}

function statusFromFirstContact(stage: FirstContactState["stage"]): RecruiterStatus {
  switch (stage) {
    case "connect_sent":
    case "dm_sent":
    case "email_sent":
      return "sent";
    case "dm_replied":
    case "email_replied":
      return "replied";
    case "meeting_scheduled":
      return "in_conversation";
    case "completed":
      return "closed";
    case "closed_no_response":
      return "archived";
    default:
      return "queue";
  }
}

function computeStats(contacts: ReconnectContact[]): ReconnectStats {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const touches = contacts.flatMap((c) => c.touches);
  return {
    toActOn: contacts.filter(
      (c) => ["TIER 1", "TIER 2"].includes(c.tier) && c.state.status === "queue"
    ).length,
    outreachThisWeek: touches.filter(
      (t) => t.direction === "outbound" && new Date(t.created_at).getTime() >= sevenDaysAgo
    ).length,
    repliesThisWeek: touches.filter(
      (t) => t.direction === "inbound" && new Date(t.created_at).getTime() >= sevenDaysAgo
    ).length,
    awaitingResponse: contacts.filter(
      (c) =>
        c.state.status === "sent" &&
        Date.now() - new Date(c.state.updated_at).getTime() >
          7 * 24 * 60 * 60 * 1000
    ).length,
    triagedReady: contacts.filter((c) => c.intent && c.state.status === "queue").length,
  };
}

function getQueue(contacts: ReconnectContact[], includeTier3: boolean) {
  return contacts
    .filter((contact) => {
      if (isBench(contact)) return false; // bench never appears in daily queue
      const tierMatch =
        contact.tier === "TIER 1" ||
        contact.tier === "TIER 2" ||
        (includeTier3 && contact.tier === "TIER 3");
      return tierMatch && contact.state.status === "queue";
    })
    .sort(compareReconnectContacts);
}

interface IntentCounts {
  total: number;
  anchors: number;
  triaged: number;
  untriaged: number;
  byIntent: Record<Intent, number>;
}

function computeIntentCounts(contacts: ReconnectContact[]): IntentCounts {
  const counts: IntentCounts = {
    total: contacts.length,
    anchors: contacts.filter((c) => c.firm_focus_rank === 1).length,
    triaged: 0,
    untriaged: 0,
    byIntent: {
      pipeline: 0,
      door: 0,
      role_inquiry: 0,
      intel: 0,
      warm: 0,
    },
  };

  for (const contact of contacts) {
    if (!contact.intent) {
      counts.untriaged += 1;
      continue;
    }
    counts.triaged += 1;
    counts.byIntent[contact.intent] += 1;
  }

  return counts;
}

function filterByIntent(contacts: ReconnectContact[], filter: IntentFilter) {
  if (!filter) return contacts;
  if (filter === "anchors_only") return contacts.filter((c) => c.firm_focus_rank === 1);
  if (filter === "triaged") return contacts.filter((contact) => !!contact.intent);
  if (filter === "untriaged") return contacts.filter((contact) => !contact.intent);
  if (filter === "triaged_ready") {
    return contacts.filter((contact) => !!contact.intent && contact.state.status === "queue");
  }
  return contacts.filter((contact) => contact.intent === filter);
}

function filterByFunnel(contacts: ReconnectContact[], filter: FunnelStage | null) {
  if (!filter) return contacts;
  return contacts.filter((contact) => getFunnelStage(contact) === filter);
}

function compareReconnectContacts(a: ReconnectContact, b: ReconnectContact) {
  const aHasIntent = !!a.intent;
  const bHasIntent = !!b.intent;
  if (aHasIntent && !bHasIntent) return -1;
  if (!aHasIntent && bHasIntent) return 1;
  if (a.intent && b.intent && a.intent !== b.intent) {
    return INTENT_PRIORITY[a.intent] - INTENT_PRIORITY[b.intent];
  }

  const byScore = (b.strategic_score ?? 0) - (a.strategic_score ?? 0);
  if (byScore) return byScore;
  return lastContactMs(a.last_contact_date) - lastContactMs(b.last_contact_date);
}

function getStageDistribution(contacts: ReconnectContact[]) {
  return contacts.reduce<Record<string, number>>((counts, contact) => {
    counts[contact.state.status] = (counts[contact.state.status] ?? 0) + 1;
    return counts;
  }, {});
}

function lastContactMs(date?: string) {
  return date ? new Date(date).getTime() : 0;
}
