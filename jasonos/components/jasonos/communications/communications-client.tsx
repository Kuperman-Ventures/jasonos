"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Building2,
  Calendar,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  HelpCircle,
  LayoutGrid,
  Link2,
  List,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  User,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  CommunicationsContact,
  CommChannel,
  CommUrgency,
  LastContactContents,
  CadenceInterval,
} from "@/lib/server-actions/communications";
import {
  dismissCommunicationContact,
  dismissContactFromSchedule,
  setContactCadence,
  syncSentToday,
  getLastContactContents,
} from "@/lib/server-actions/communications";
import { dismissCadenceContact } from "@/lib/server-actions/cadence";
import { getFirmmates } from "@/lib/server-actions/firmmates";
import type { Firmmate } from "@/lib/server-actions/firmmates";
import { FocusBadge } from "@/components/jasonos/reconnect/focus-badge";
import { isBench } from "@/lib/reconnect/firm-focus";
import {
  CADENCE_HELPERS,
  CADENCE_INTERVALS,
  CADENCE_LABELS,
} from "@/lib/outreach/types";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const URGENCY_ORDER: CommUrgency[] = [
  "sent_today",
  "due_today",
  "this_week",
  "scheduled",
  "needs_scheduling",
];

const URGENCY_CONFIG: Record<
  CommUrgency,
  {
    label: string;
    helper: string;
    icon: React.ReactNode;
    textColor: string;
    headerBg: string;
  }
> = {
  sent_today: {
    label: "Sent Today",
    helper: "Outbound touches recorded today from your accounts",
    icon: <Mail className="h-4 w-4" />,
    textColor: "text-emerald-300",
    headerBg: "bg-emerald-700/70",
  },
  due_today: {
    label: "Due Now",
    helper: "Past their scheduled next-touch date — reach out today",
    icon: <AlertCircle className="h-4 w-4" />,
    textColor: "text-red-300",
    headerBg: "bg-red-700/80",
  },
  this_week: {
    label: "This Week",
    helper: "Scheduled for outreach in the next 7 days",
    icon: <Clock className="h-4 w-4" />,
    textColor: "text-amber-300",
    headerBg: "bg-amber-600/70",
  },
  scheduled: {
    label: "Scheduled",
    helper: "Next touch set — coming up after this week",
    icon: <Calendar className="h-4 w-4" />,
    textColor: "text-sky-300",
    headerBg: "bg-sky-800/50",
  },
  needs_scheduling: {
    label: "Needs Scheduling",
    helper: "No next-touch date set — set a cadence to activate",
    icon: <HelpCircle className="h-4 w-4" />,
    textColor: "text-muted-foreground",
    headerBg: "bg-muted/60",
  },
};

const CHANNEL_ICONS: Record<CommChannel, React.ReactNode> = {
  email: <Mail className="h-3.5 w-3.5" />,
  linkedin: <Link2 className="h-3.5 w-3.5" />,
  phone: <Phone className="h-3.5 w-3.5" />,
  meeting: <Video className="h-3.5 w-3.5" />,
  other: <MessageSquare className="h-3.5 w-3.5" />,
};

const CHANNEL_LABELS: Record<CommChannel, string> = {
  email: "Email",
  linkedin: "LinkedIn",
  phone: "Phone",
  meeting: "Meeting",
  other: "Other",
};

function cadenceLabel(interval: CadenceInterval): string {
  return CADENCE_LABELS[interval] ?? interval;
}

// "Currently scheduled: <date> (in N days)" / overdue / today / no-date copy
// for the informational line above the cadence picker.
function formatScheduledLine(nextActionDueDate: string | null): string {
  if (!nextActionDueDate) return "No next touch scheduled.";
  const target = new Date(`${nextActionDueDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) return "No next touch scheduled.";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / 86_400_000
  );
  const human = fmtDate(nextActionDueDate);
  if (diffDays < 0) {
    const days = Math.abs(diffDays);
    return `Currently scheduled: ${human} (${days}d overdue)`;
  }
  if (diffDays === 0) return `Currently scheduled: ${human} (today)`;
  if (diffDays === 1) return `Currently scheduled: ${human} (in 1 day)`;
  return `Currently scheduled: ${human} (in ${diffDays} days)`;
}

const SORT_OPTIONS = [
  "Priority score",
  "Last contact",
  "Name",
  "Company",
] as const;

type SortOption = (typeof SORT_OPTIONS)[number];

// ---------------------------------------------------------------------------
// Main layout
// ---------------------------------------------------------------------------

export function CommunicationsClient({
  contacts,
  gmailConnected = true,
}: {
  contacts: CommunicationsContact[];
  gmailConnected?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Bench toggle — default off, persists in ?bench=1
  const [showBench, setShowBench] = useState(
    () => searchParams.get("bench") === "1"
  );

  useEffect(() => {
    if (searchParams.get("google_connected") === "1") {
      toast.success("Gmail connected!", {
        description: "Hit 'Sync today' to pull your sent emails.",
      });
      const url = new URL(window.location.href);
      url.searchParams.delete("google_connected");
      router.replace(url.pathname + url.search, { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (showBench) url.searchParams.set("bench", "1");
    else url.searchParams.delete("bench");
    router.replace(url.pathname + url.search, { scroll: false });
  }, [showBench, router]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listView, setListView] = useState<"list" | "grid">("list");
  const [sort, setSort] = useState<SortOption>("Priority score");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [isSyncing, setIsSyncing] = useState(false);
  const [gmailNotConnected, setGmailNotConnected] = useState(!gmailConnected);
  const [needsSchedOpen, setNeedsSchedOpen] = useState(true);
  const [sentTodayOpen, setSentTodayOpen] = useState(true);
  const [scheduledOpen, setScheduledOpen] = useState(false);
  const [urgencyFilter, setUrgencyFilter] = useState<CommUrgency | null>(null);

  const today = new Date().toISOString().split("T")[0];

  // Kept intact alongside the syncSentToday import — the Schedule-local
  // "Sync today" button that called this has been removed, but the global
  // sync surface still uses the syncSentToday server action and may want
  // this wrapper. Remove only as a separate cleanup.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const requestEmailSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await syncSentToday();
      if (!result.ok) {
        if (result.error === "gmail_not_connected") {
          setGmailNotConnected(true);
          toast.error("Gmail not connected", {
            description: "Click 'Connect Gmail' in the banner above to authorise access.",
          });
          return;
        }
        throw new Error(result.error ?? "Sync failed");
      }
      setGmailNotConnected(false);
      const skippedLine = result.skippedDetails?.length
        ? ` · Unmatched: ${result.skippedDetails.map((d) => d.to).join(", ")}`
        : result.skippedUnmatched
        ? ` · Skipped: ${result.skippedUnmatched}`
        : "";
      toast.success(
        `Synced ${result.written} new touch${result.written === 1 ? "" : "es"}`,
        { description: `Gmail: ${result.gmail} · HubSpot: ${result.hubspot}${skippedLine}` }
      );
      router.refresh();
    } catch (err) {
      toast.error("Sync failed", {
        description: err instanceof Error ? err.message : "Check the server logs.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const activeContacts = useMemo(
    () => contacts.filter((c) => !dismissed.has(c.id)),
    [contacts, dismissed]
  );

  const nonAnchorCount = useMemo(
    () => activeContacts.filter((c) => c.firm_focus_rank !== null && c.firm_focus_rank > 1).length,
    [activeContacts]
  );

  const filteredForList = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = showBench
      ? activeContacts
      : activeContacts.filter(
          (c) => c.firm_focus_rank === null || c.firm_focus_rank === 1
        );
    const urgencyFiltered = urgencyFilter
      ? base.filter((c) => c.urgency === urgencyFilter)
      : base;
    const list = q
      ? urgencyFiltered.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.firm ?? "").toLowerCase().includes(q)
        )
      : urgencyFiltered;

    return [...list].sort((a, b) => {
      if (sort === "Last contact") {
        const at = (c: CommunicationsContact) =>
          c.lastTouch?.touched_at ?? "";
        return at(b).localeCompare(at(a));
      }
      if (sort === "Name") return a.name.localeCompare(b.name);
      if (sort === "Company")
        return (a.firm ?? "").localeCompare(b.firm ?? "");
      return b.strength - a.strength;
    });
  }, [activeContacts, query, sort, urgencyFilter]);

  const selectedContact = selectedId
    ? activeContacts.find((c) => c.id === selectedId) ?? null
    : null;

  const handleSelect = (id: string) =>
    setSelectedId((prev) => (prev === id ? null : id));

  const handleDismiss = (id: string) => {
    const target = activeContacts.find((c) => c.id === id) ?? null;
    setDismissed((prev) => new Set([...prev, id]));
    if (selectedId === id) setSelectedId(null);
    if (target?.source === "cadence") {
      if (target.cadenceCardId) {
        void dismissCadenceContact(target.cadenceCardId);
      } else {
        // Pure jasonos.contacts row (no cadence card) — flag it backrow so
        // the unified Schedule loader excludes it on next load.
        void dismissContactFromSchedule(id);
      }
    } else {
      void dismissCommunicationContact(id);
    }
  };

  return (
    <div className="grid grid-cols-3 h-[calc(100vh-3rem)] overflow-hidden">
      {/* ---------------------------------------------------------------- */}
      {/* LEFT — Contact list                                              */}
      {/* ---------------------------------------------------------------- */}
      <aside className="flex flex-col border-r bg-card/50 min-h-0">
        <div className="border-b p-3 space-y-2 shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">Contacts</h2>
            <div className="flex items-center gap-2">
              {nonAnchorCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowBench((v) => !v)}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showBench ? "Hide bench" : `Show bench (${nonAnchorCount})`}
                </button>
              ) : null}
              <div className="flex items-center gap-1">
                <Button
                  size="icon-xs"
                  variant={listView === "list" ? "secondary" : "ghost"}
                  onClick={() => setListView("list")}
                  aria-label="List view"
                >
                  <List className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon-xs"
                  variant={listView === "grid" ? "secondary" : "ghost"}
                  onClick={() => setListView("grid")}
                  aria-label="Grid view"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or company…"
              className="pl-7 h-8 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="flex-1 bg-transparent text-xs text-muted-foreground border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-1">
            {URGENCY_ORDER.map((u) => {
              const count = activeContacts.filter(
                (c) => c.urgency === u
              ).length;
              if (!count) return null;
              const cfg = URGENCY_CONFIG[u];
              const active = urgencyFilter === u;
              return (
                <button
                  key={u}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setUrgencyFilter((current) => (current === u ? null : u))
                  }
                  className={`rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {cfg.label} · {count}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {filteredForList.length === 0 && (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No contacts found
            </div>
          )}

          {/* Needs Scheduling — takes remaining space, scrolls within */}
          {(() => {
            const bucket = filteredForList.filter((c) => c.urgency === "needs_scheduling");
            if (!bucket.length) return null;
            return (
              <div className="flex flex-col min-h-0 border-b" style={{ flex: needsSchedOpen ? "1 1 0" : "0 0 auto" }}>
                <button
                  type="button"
                  onClick={() => setNeedsSchedOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 hover:bg-muted/60 transition-colors shrink-0"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Needs Scheduling · {bucket.length}
                  </span>
                  {needsSchedOpen
                    ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                    : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
                {needsSchedOpen && (
                  <div className="flex-1 overflow-y-auto divide-y divide-border/40 min-h-0">
                    {bucket.map((contact) => (
                      <LeftListRow
                        key={contact.id}
                        contact={contact}
                        selected={selectedId === contact.id}
                        onSelect={handleSelect}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Sent Today — collapsible, only shown when there are items */}
          {(() => {
            const bucket = filteredForList.filter((c) => c.urgency === "sent_today");
            if (!bucket.length) return null;
            return (
              <div className="shrink-0 border-b">
                <button
                  type="button"
                  onClick={() => setSentTodayOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-emerald-900/20 hover:bg-emerald-900/30 transition-colors"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/80">
                    Sent Today · {bucket.length}
                  </span>
                  {sentTodayOpen
                    ? <ChevronUp className="h-3.5 w-3.5 text-emerald-400/60" />
                    : <ChevronDown className="h-3.5 w-3.5 text-emerald-400/60" />}
                </button>
                {sentTodayOpen && (
                  <div className="divide-y divide-border/40">
                    {bucket.map((contact) => (
                      <LeftListRow
                        key={contact.id}
                        contact={contact}
                        selected={selectedId === contact.id}
                        onSelect={handleSelect}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Scheduled — bottom, collapsible (due_today + this_week + scheduled) */}
          {(() => {
            const bucket = filteredForList.filter(
              (c) => c.urgency === "due_today" || c.urgency === "this_week" || c.urgency === "scheduled"
            );
            if (!bucket.length) return null;
            return (
              <div className="shrink-0 border-t">
                <button
                  type="button"
                  onClick={() => setScheduledOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-sky-900/20 hover:bg-sky-900/30 transition-colors"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-400/80">
                    Scheduled · {bucket.length}
                  </span>
                  {scheduledOpen
                    ? <ChevronUp className="h-3.5 w-3.5 text-sky-400/60" />
                    : <ChevronDown className="h-3.5 w-3.5 text-sky-400/60" />}
                </button>
                {scheduledOpen && (
                  <div className="max-h-64 overflow-y-auto divide-y divide-border/40">
                    {bucket.map((contact) => (
                      <LeftListRow
                        key={contact.id}
                        contact={contact}
                        selected={selectedId === contact.id}
                        onSelect={handleSelect}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        <div className="border-t p-2 text-center text-[11px] text-muted-foreground shrink-0">
          {activeContacts.length} contacts
        </div>
      </aside>

      {/* ---------------------------------------------------------------- */}
      {/* MIDDLE — Outreach Grid                                           */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex flex-col border-r min-h-0 overflow-hidden">
        <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-2 shrink-0">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold tracking-tight">
              Outreach Grid
            </span>
            <Badge variant="secondary" className="text-[10px]">
              {activeContacts.length}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => router.refresh()}
            >
              <RotateCcw className="h-3 w-3" />
              Refresh
            </Button>
          </div>
        </div>

        {gmailNotConnected ? (
          <div className="flex items-center justify-between gap-3 border-b bg-amber-500/10 px-4 py-2.5 shrink-0">
            <div className="text-xs text-amber-300">
              Gmail not connected — sync returned 0 emails.
            </div>
            <a
              href="/api/auth/google"
              className="shrink-0 rounded-md border border-amber-400/40 bg-amber-500/20 px-3 py-1 text-[11px] font-medium text-amber-200 hover:bg-amber-500/30 transition-colors"
            >
              Connect Gmail →
            </a>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto min-h-0">
          {URGENCY_ORDER.filter(
            (urgency) => !urgencyFilter || urgency === urgencyFilter
          ).map((urgency) => {
            const bucket = filteredForList.filter(
              (c) => c.urgency === urgency
            );
            return (
              <UrgencySection
                key={urgency}
                urgency={urgency}
                contacts={bucket}
                selectedId={selectedId}
                onSelect={handleSelect}
              />
            );
          })}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* RIGHT — Contact detail                                           */}
      {/* ---------------------------------------------------------------- */}
      {selectedContact ? (
        <ContactDetailPanel
          key={selectedContact.id}
          contact={selectedContact}
          onSelectPeer={handleSelect}
          onDismiss={handleDismiss}
        />
      ) : (
        <div className="flex items-center justify-center bg-muted/10 text-xs text-muted-foreground">
          <div className="text-center space-y-1 px-6">
            <User className="mx-auto h-6 w-6 text-muted-foreground/30" />
            <div>Select a contact to view details</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contact detail panel
// ---------------------------------------------------------------------------

function ContactDetailPanel({
  contact,
  onSelectPeer,
  onDismiss,
}: {
  contact: CommunicationsContact;
  onSelectPeer: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const router = useRouter();
  const initialCadence: CadenceInterval = contact.cadenceInterval ?? "none";
  const [cadence, setCadenceLocal] = useState<CadenceInterval>(initialCadence);
  const [isPending, startTransition] = useTransition();
  const [isDismissPending, startDismissTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [firmmates, setFirmmates] = useState<Firmmate[]>([]);

  // Picker is a no-op until the user picks a cadence different from the
  // contact's current canonical cadence_interval.
  const canSet = cadence !== initialCadence;
  const scheduledLine = formatScheduledLine(contact.nextActionDueDate);

  useEffect(() => {
    let active = true;
    setFirmmates([]);
    getFirmmates(contact.id)
      .then((data) => { if (active) setFirmmates(data); })
      .catch(() => {});
    return () => { active = false; };
  }, [contact.id]);

  const handleSetCadence = () => {
    if (!canSet) return;
    const choice = cadence;
    startTransition(async () => {
      const result = await setContactCadence(contact.id, choice);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  };

  const handleDismiss = () => {
    startDismissTransition(() => {
      onDismiss(contact.id);
    });
  };

  return (
    <aside className="flex flex-col bg-card/60 min-h-0 overflow-y-auto">
      {/* Header */}
      <div className="border-b p-4 space-y-2 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight leading-tight">
              {contact.name}
            </h2>
            {contact.title ? (
              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                {contact.title}
              </div>
            ) : null}
          </div>
          <StrengthDots strength={contact.strength} />
        </div>
        {contact.firm ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium text-foreground/80">{contact.firm}</span>
          </div>
        ) : null}
        {contact.source === "cadence" && contact.cadenceInterval && contact.cadenceInterval !== "none" ? (
          <div className="inline-flex items-center gap-1.5 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-300">
            <RefreshCw className="h-3 w-3" />
            {cadenceLabel(contact.cadenceInterval)} cadence
          </div>
        ) : null}
        {contact.hubspot_url ? (
          <a
            href={contact.hubspot_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Link2 className="h-3 w-3" />
            HubSpot record
          </a>
        ) : null}
      </div>

      <div className="flex flex-col gap-5 p-4">
        {/* Timeline */}
        <ContactTimeline contact={contact} />

        {/* Last contact */}
        <section className="space-y-1.5">
          <SectionLabel>Last Contact</SectionLabel>
          {contact.lastTouch ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  {CHANNEL_ICONS[contact.lastTouch.channel]}
                </span>
                <span className="font-medium">
                  {CHANNEL_LABELS[contact.lastTouch.channel]}
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">
                  {fmtDate(contact.lastTouch.touched_at)}
                </span>
                <span
                  className={`ml-auto text-[10px] px-1.5 py-0.5 rounded border ${
                    contact.lastTouch.direction === "inbound"
                      ? "border-blue-500/40 text-blue-400"
                      : "border-emerald-500/40 text-emerald-400"
                  }`}
                >
                  {contact.lastTouch.direction === "inbound" ? "Inbound" : "Outbound"}
                </span>
              </div>
              {contact.lastTouch.brief ? (
                <p className="text-xs leading-relaxed text-foreground/80 rounded-md border bg-muted/30 p-2.5">
                  {contact.lastTouch.brief}
                </p>
              ) : contact.summaryOfPriorComms ? (
                <p className="text-xs leading-relaxed text-foreground/80 rounded-md border bg-muted/30 p-2.5 italic">
                  {contact.summaryOfPriorComms}
                </p>
              ) : null}
            </div>
          ) : contact.summaryOfPriorComms ? (
            <p className="text-xs leading-relaxed text-foreground/80 rounded-md border bg-muted/30 p-2.5 italic">
              {contact.summaryOfPriorComms}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No contact recorded yet.
            </p>
          )}
        </section>

        {/* Last contact contents */}
        <LastContactContentsSection contactId={contact.id} />

        {/* Other contacts at this firm */}
        {firmmates.length > 0 ? (
          <section className="space-y-1.5">
            <SectionLabel>Other contacts at {contact.firm}</SectionLabel>
            <ul className="space-y-1">
              {firmmates.map((m) => {
                const benched = (m.firm_focus_rank ?? 0) > 3;
                return (
                  <li
                    key={m.contact_id}
                    className={`flex items-center gap-2 rounded-md border bg-background/40 px-2.5 py-2 ${benched ? "opacity-60" : ""}`}
                  >
                    <FocusBadge rank={m.firm_focus_rank} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{m.name}</div>
                      {m.title ? (
                        <div className="text-[10px] text-muted-foreground truncate">{m.title}</div>
                      ) : null}
                    </div>
                    {m.strategic_score != null ? (
                      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                        {m.strategic_score}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {firmmates.some((m) => (m.firm_focus_rank ?? 0) > 1) ? (
              <p className="text-xs text-amber-300/80">
                Don&rsquo;t reach bench contacts independently — search firms share notes in their internal CRMs. Let the anchor loop them in.
              </p>
            ) : null}
          </section>
        ) : contact.firm_focus_rank === 1 ? (
          <p className="text-xs text-emerald-300/70 italic">
            Solo anchor — this contact IS the firm relationship.
          </p>
        ) : null}

        {/* Cadence */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <SectionLabel>Cadence</SectionLabel>
            <span className="text-[10px] text-muted-foreground">
              Current: {cadenceLabel(initialCadence)}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {CADENCE_INTERVALS.map((value) => {
              const active = cadence === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setCadenceLocal(value);
                    setSaved(false);
                  }}
                  className={`rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors ${
                    active
                      ? "border-foreground/60 bg-foreground text-background"
                      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <div className="font-medium">{CADENCE_LABELS[value]}</div>
                  <div
                    className={`text-[10px] font-normal ${
                      active
                        ? "text-background/70"
                        : "text-muted-foreground/70"
                    }`}
                  >
                    {CADENCE_HELPERS[value]}
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-muted-foreground">{scheduledLine}</p>

          {saved ? (
            <div className="w-full rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-center text-xs text-emerald-400">
              Saved ✓
            </div>
          ) : (
            <Button
              size="sm"
              className="w-full"
              onClick={handleSetCadence}
              disabled={isPending || !canSet}
            >
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              {isPending
                ? "Saving…"
                : !canSet
                ? "Already set"
                : "Set Cadence"}
            </Button>
          )}
        </section>

        {/* Peers at company */}
        {contact.peers.length > 0 ? (
          <section className="space-y-2">
            <SectionLabel>
              Others at {contact.firm} ({contact.peers.length})
            </SectionLabel>
            <div className="space-y-1">
              {contact.peers.map((peer) => (
                <button
                  key={peer.id}
                  type="button"
                  onClick={() => onSelectPeer(peer.id)}
                  className="w-full flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-left transition-colors hover:bg-muted/60 hover:border-foreground/30"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">
                      {peer.name}
                    </div>
                    {peer.title ? (
                      <div className="text-[10px] text-muted-foreground truncate">
                        {peer.title}
                      </div>
                    ) : null}
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* Dismiss */}
        <section className="pt-2 border-t border-border/40">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={handleDismiss}
            disabled={isDismissPending}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            {isDismissPending ? "Removing…" : "Dismiss contact"}
          </Button>
          <p className="mt-1 text-center text-[10px] text-muted-foreground/60">
            Removes from Communications view. Useful for personal contacts.
          </p>
        </section>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Urgency section
// ---------------------------------------------------------------------------

const ROW_URGENCIES: CommUrgency[] = ["scheduled", "needs_scheduling"];

function UrgencySection({
  urgency,
  contacts,
  selectedId,
  onSelect,
}: {
  urgency: CommUrgency;
  contacts: CommunicationsContact[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const cfg = URGENCY_CONFIG[urgency];
  const useRows = ROW_URGENCIES.includes(urgency);

  return (
    <div>
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left ${cfg.headerBg}`}
      >
        <div className="flex items-center gap-2">
          <span className={cfg.textColor}>{cfg.icon}</span>
          <div>
            <div className={`text-sm font-semibold ${cfg.textColor}`}>
              {cfg.label}
            </div>
            <div className="text-[11px] text-white/60">{cfg.helper}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {contacts.length > 0 ? (
            <span className="text-xs font-medium text-white/80">
              {contacts.length}
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
        useRows ? (
          <div className="max-h-48 overflow-y-auto bg-card/10 divide-y divide-border/30">
            {contacts.length ? (
              contacts.map((contact) => (
                <ContactRow
                  key={contact.id}
                  contact={contact}
                  selected={selectedId === contact.id}
                  onSelect={onSelect}
                />
              ))
            ) : (
              <div className="px-4 py-3 text-xs text-muted-foreground italic">
                No contacts in this bucket
              </div>
            )}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto px-4 py-3 bg-card/20">
            {contacts.length ? (
              contacts.map((contact) => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  selected={selectedId === contact.id}
                  onSelect={onSelect}
                />
              ))
            ) : (
              <div className="text-xs text-muted-foreground py-2 italic">
                No contacts in this bucket
              </div>
            )}
          </div>
        )
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compact contact row (used for Scheduled + Needs Scheduling)
// ---------------------------------------------------------------------------

function ContactRow({
  contact,
  selected,
  onSelect,
}: {
  contact: CommunicationsContact;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(contact.id)}
      className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-muted/30 ${
        selected ? "bg-muted/40 border-l-2 border-foreground/50" : "border-l-2 border-transparent"
      }`}
    >
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium truncate">{contact.name}</span>
        {contact.firm ? (
          <span className="text-[10px] text-muted-foreground ml-1.5">· {contact.firm}</span>
        ) : null}
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {contact.nextActionDueDate ? (
          <span className="text-[10px] text-sky-400">{fmtDate(contact.nextActionDueDate)}</span>
        ) : contact.lastTouch ? (
          <span className="text-[10px] text-muted-foreground">
            {CHANNEL_LABELS[contact.lastTouch.channel]} · {fmtDate(contact.lastTouch.touched_at)}
          </span>
        ) : null}
        <StrengthDots strength={contact.strength} />
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Mini contact card
// ---------------------------------------------------------------------------

function ContactCard({
  contact,
  selected,
  onSelect,
}: {
  contact: CommunicationsContact;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(contact.id)}
      className={`h-[90px] w-[130px] shrink-0 rounded-lg border bg-card p-2.5 text-left transition-colors hover:border-foreground/40 ${
        selected
          ? "border-foreground/70 ring-1 ring-foreground/30"
          : "border-border/60"
      }`}
    >
      <div className="text-xs font-medium leading-tight line-clamp-2">
        {contact.name}
      </div>
      <div className="mt-0.5 text-[10px] text-muted-foreground truncate">
        {contact.firm ?? "—"}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        {contact.lastTouch ? (
          <span className="text-muted-foreground">
            {CHANNEL_ICONS[contact.lastTouch.channel]}
          </span>
        ) : null}
        <StrengthDots strength={contact.strength} />
      </div>
      {contact.lastTouch ? (
        <div className="mt-0.5 text-[9px] text-muted-foreground/60">
          {fmtDate(contact.lastTouch.touched_at)}
        </div>
      ) : null}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Left column contact row
// ---------------------------------------------------------------------------

function LeftListRow({
  contact,
  selected,
  onSelect,
}: {
  contact: CommunicationsContact;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const urgency = URGENCY_CONFIG[contact.urgency];
  const benched = isBench(contact);
  return (
    <button
      type="button"
      onClick={() => onSelect(contact.id)}
      className={`w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/40 border-l-2 ${
        selected ? "bg-muted/60 border-foreground/60" : "border-transparent"
      } ${benched ? "opacity-50 hover:opacity-100" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <FocusBadge rank={contact.firm_focus_rank} />
            <span className="text-sm font-medium truncate">{contact.name}</span>
          </div>
          <div className="text-xs text-muted-foreground truncate">{contact.firm ?? "—"}</div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <StrengthDots strength={contact.strength} />
          {contact.lastTouch ? (
            <span className="text-[10px] text-muted-foreground">
              {CHANNEL_LABELS[contact.lastTouch.channel]} · {fmtDate(contact.lastTouch.touched_at)}
            </span>
          ) : contact.nextActionDueDate ? (
            <span className="text-[10px] text-sky-400">{fmtDate(contact.nextActionDueDate)}</span>
          ) : null}
        </div>
      </div>
      <div className="mt-0.5">
        <span className={`text-[10px] font-medium ${urgency.textColor}`}>{urgency.label}</span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Last Contact Contents — lazy-fetches Gmail / HubSpot email body
// ---------------------------------------------------------------------------

function LastContactContentsSection({ contactId }: { contactId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "loaded" | "empty" | "error">("idle");
  const [content, setContent] = useState<LastContactContents | null>(null);

  useEffect(() => {
    setState("loading");
    setContent(null);
    getLastContactContents(contactId)
      .then((c) => {
        if (!c) { setState("empty"); return; }
        setContent(c);
        setState("loaded");
      })
      .catch(() => setState("error"));
  }, [contactId]);

  return (
    <section className="space-y-1.5">
      <SectionLabel>Last Contact Contents</SectionLabel>
      {state === "loading" ? (
        <p className="text-xs text-muted-foreground italic">Fetching from Gmail + HubSpot…</p>
      ) : state === "empty" ? (
        <p className="text-xs text-muted-foreground italic">
          No email found in Gmail or HubSpot.
        </p>
      ) : state === "error" ? (
        <p className="text-xs text-muted-foreground italic">
          Could not load. Check integrations or hit Refresh.
        </p>
      ) : content ? (
        <div className="space-y-1.5 rounded-md border bg-muted/30 p-2.5">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-medium leading-snug truncate">
              {content.subject ?? "(no subject)"}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <span
                className={`text-[9px] px-1 py-0.5 rounded border ${
                  content.direction === "inbound"
                    ? "border-blue-500/40 text-blue-400"
                    : "border-emerald-500/40 text-emerald-400"
                }`}
              >
                {content.direction}
              </span>
              <span className="text-[9px] text-muted-foreground uppercase tracking-wide">
                {content.source}
              </span>
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground">{fmtDate(content.sentAt)}</div>
          <p className="text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap line-clamp-8">
            {content.body}
          </p>
          {content.threadUrl ? (
            <a
              href={content.threadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Link2 className="h-3 w-3" />
              Open in {content.source === "gmail" ? "Gmail" : "HubSpot"}
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

function StrengthDots({ strength }: { strength: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${
            i < strength ? "bg-foreground/70" : "bg-muted-foreground/20"
          }`}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contact timeline
// ---------------------------------------------------------------------------

function startOfThisWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // Sunday
  return d;
}

function endOfThisWeek(): Date {
  const d = startOfThisWeek();
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function ContactTimeline({ contact }: { contact: CommunicationsContact }) {
  const now = new Date();
  const weekStart = startOfThisWeek();
  const weekEnd = endOfThisWeek();

  // Find the most recent touch this week (if any)
  const thisWeekTouch = contact.recentTouches.find((t) => {
    const d = new Date(t.touched_at);
    return d >= weekStart && d <= weekEnd;
  }) ?? null;

  // Last touch before this week
  const lastTouch = contact.recentTouches.find((t) => {
    return new Date(t.touched_at) < weekStart;
  }) ?? contact.lastTouch;

  // Next scheduled
  const nextDue = contact.nextActionDueDate ?? null;
  const nextDueDate = nextDue ? new Date(nextDue) : null;
  const nextIsFuture = nextDueDate ? nextDueDate > now : false;

  const nodes: Array<{
    key: string;
    label: string;
    detail: string | null;
    status: "done" | "upcoming" | "empty";
    isToday?: boolean;
  }> = [
    {
      key: "last",
      label: "Last connect",
      detail: lastTouch ? `${CHANNEL_LABELS[lastTouch.channel]} · ${fmtDate(lastTouch.touched_at)}` : null,
      status: lastTouch ? "done" : "empty",
    },
    {
      key: "week",
      label: "This week",
      detail: thisWeekTouch
        ? `${CHANNEL_LABELS[thisWeekTouch.channel]} · ${fmtDate(thisWeekTouch.touched_at)}`
        : nextDueDate && nextDueDate >= weekStart && nextDueDate <= weekEnd
        ? `Scheduled ${fmtDate(nextDue!)}`
        : null,
      status: thisWeekTouch
        ? "done"
        : nextDueDate && nextDueDate >= weekStart && nextDueDate <= weekEnd
        ? "upcoming"
        : "empty",
    },
    {
      key: "next",
      label: "Next scheduled",
      detail: nextDue && nextIsFuture ? fmtDate(nextDue) : null,
      status: nextDue && nextIsFuture ? "upcoming" : "empty",
    },
  ];

  return (
    <section>
      <SectionLabel>Timeline</SectionLabel>
      <div className="relative mt-2 pl-4">
        {/* Vertical line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border/60" />

        <div className="space-y-3">
          {nodes.map((node) => (
            <div key={node.key} className="relative flex items-start gap-2.5">
              {/* Dot */}
              <div
                className={`relative z-10 mt-[3px] h-3 w-3 shrink-0 rounded-full border-2 ${
                  node.status === "done"
                    ? "border-emerald-400 bg-emerald-400/30"
                    : node.status === "upcoming"
                    ? "border-sky-400 bg-sky-400/20"
                    : "border-border bg-background"
                }`}
              />
              <div className="min-w-0 pb-0.5">
                <div
                  className={`text-[11px] font-semibold uppercase tracking-wider ${
                    node.status === "done"
                      ? "text-emerald-400/80"
                      : node.status === "upcoming"
                      ? "text-sky-400/80"
                      : "text-muted-foreground/50"
                  }`}
                >
                  {node.label}
                </div>
                {node.detail ? (
                  <div className="mt-0.5 text-xs text-foreground/75">{node.detail}</div>
                ) : (
                  <div className="mt-0.5 text-xs text-muted-foreground/40 italic">
                    {node.key === "last" ? "No contact yet" : node.key === "week" ? "Nothing this week" : "Not scheduled"}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
