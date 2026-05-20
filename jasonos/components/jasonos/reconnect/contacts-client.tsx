"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, ChevronDown, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Intent } from "@/lib/triage/types";
import type {
  ReconnectContact,
  RecruiterSource,
  RecruiterStatus,
  RecruiterTier,
} from "@/lib/reconnect/types";
import { RECRUITER_STATUS_LABELS } from "@/lib/reconnect/constants";
import { TierBadge } from "./tier-badge";
import { ScoreChip } from "./score-chip";
import { IntentBadge } from "./intent-badge";
import { FocusBadge } from "./focus-badge";
import { isBench } from "@/lib/reconnect/firm-focus";
import { OutreachModal } from "@/components/jasonos/outreach/outreach-modal";

const TIERS: RecruiterTier[] = ["TIER 1", "TIER 2", "TIER 3", "TIER 4"];
const STATUSES: RecruiterStatus[] = [
  "queue",
  "sent",
  "replied",
  "in_conversation",
  "live_role",
  "closed",
  "snoozed",
  "archived",
];
const SOURCES: RecruiterSource[] = ["LeadDelta", "Outlook (new)", "HubSpot (new)", "Both"];

export function ReconnectContactsClient({
  contacts: initialContacts,
  initialTier,
  initialStatus,
  initialSource,
  initialQ,
}: {
  contacts: ReconnectContact[];
  initialTier: RecruiterTier[];
  initialStatus: RecruiterStatus[];
  initialSource: RecruiterSource[];
  initialQ: string;
}) {
  const router = useRouter();
  const [contacts, setContacts] = useState(initialContacts);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tiers, setTiers] = useState<RecruiterTier[]>(initialTier);
  const [statuses, setStatuses] = useState<RecruiterStatus[]>(initialStatus);
  const [sources, setSources] = useState<RecruiterSource[]>(initialSource);
  const [query, setQuery] = useState(initialQ);
  const [recruitersOpen, setRecruitersOpen] = useState(true);
  const [contactsOpen, setContactsOpen] = useState(true);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (tiers.length) params.set("tier", tiers.join(","));
      if (statuses.length) params.set("status", statuses.join(","));
      if (sources.length) params.set("source", sources.join(","));
      if (query.trim()) params.set("q", query.trim());
      router.replace(`/reconnect/contacts${params.size ? `?${params}` : ""}`, {
        scroll: false,
      });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [tiers, statuses, sources, query, router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts
      .filter((c) => (tiers.length ? tiers.includes(c.tier) : true))
      .filter((c) => (statuses.length ? statuses.includes(c.state.status) : true))
      .filter((c) => (sources.length ? sources.includes(c.source) : true))
      .filter((c) => {
        if (!q) return true;
        return [
          c.name,
          c.firm,
          c.specialty,
          c.summary_of_prior_comms,
          c.strategic_recommended_approach,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => b.strategic_score - a.strategic_score);
  }, [contacts, tiers, statuses, sources, query]);

  const selected = selectedId ? contacts.find((c) => c.id === selectedId) ?? null : null;
  const recruiters = useMemo(
    () => filtered.filter((contact) => contact.reconnect_object_type === "recruiter"),
    [filtered]
  );
  const otherContacts = useMemo(
    () => filtered.filter((contact) => contact.reconnect_object_type !== "recruiter"),
    [filtered]
  );

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-4 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" render={<Link href="/reconnect" />} className="-ml-2 mb-2">
            <ArrowLeft className="h-4 w-4" />
            Today&rsquo;s Queue
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Reconnect Contacts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Full recruiter pipeline. Filters are preserved in the URL for bookmarkable views.
          </p>
        </div>
        <div className="num-mono rounded-lg border bg-card px-3 py-2 text-sm">
          {filtered.length} / {contacts.length}
        </div>
      </header>

      <section className="rounded-xl border bg-card p-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_auto_auto_auto]">
          <div className="relative">
            <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, firm, specialty, summary..."
              className="pl-8"
            />
          </div>
          <FilterGroup values={TIERS} selected={tiers} onToggle={toggle(tiers, setTiers)} />
          <FilterGroup
            values={STATUSES}
            selected={statuses}
            onToggle={toggle(statuses, setStatuses)}
            label={(s) => RECRUITER_STATUS_LABELS[s]}
          />
          <FilterGroup values={SOURCES} selected={sources} onToggle={toggle(sources, setSources)} />
        </div>
      </section>

      <ContactSection
        title="Recruiters"
        description="Executive search and recruiter relationships."
        contacts={recruiters}
        open={recruitersOpen}
        onToggle={() => setRecruitersOpen((value) => !value)}
        onOpenContact={setSelectedId}
        emptyMessage="No recruiters match the current filters."
      />

      <ContactSection
        title="Contacts"
        description="Tier 1, manual, and future non-recruiter reconnect contacts."
        contacts={otherContacts}
        open={contactsOpen}
        onToggle={() => setContactsOpen((value) => !value)}
        onOpenContact={setSelectedId}
        emptyMessage="No non-recruiter contacts match the current filters yet."
      />

      {selected ? (
        <OutreachModal
          open={!!selected}
          onOpenChange={(open) => {
            if (!open) setSelectedId(null);
          }}
          recruiterId={selected.id}
          initialDisplay={{
            name: selected.name,
            title: selected.title ?? null,
            firm: selected.firm ?? null,
          }}
          recruiterPipeline={{
            contact: selected,
            contacts,
            onLocalStatus: (id, status, note) =>
              setContacts((current) =>
                current.map((c) =>
                  c.id === id
                    ? {
                        ...c,
                        state: {
                          ...c.state,
                          status,
                          updated_at: new Date().toISOString(),
                        },
                        notes: note
                          ? [
                              {
                                id: `local-note-${Date.now()}`,
                                recruiter_id: id,
                                body: note,
                                created_at: new Date().toISOString(),
                              },
                              ...c.notes,
                            ]
                          : c.notes,
                      }
                    : c
                )
              ),
            onLocalNote: (id, body) =>
              setContacts((current) =>
                current.map((c) =>
                  c.id === id
                    ? {
                        ...c,
                        notes: [
                          {
                            id: `local-note-${Date.now()}`,
                            recruiter_id: id,
                            body,
                            created_at: new Date().toISOString(),
                          },
                          ...c.notes,
                        ],
                      }
                    : c
                )
              ),
            onLocalTriage: (
              id: string,
              intent: Intent | null,
              personalGoal: string | null
            ) =>
              setContacts((current) =>
                current.map((c) =>
                  c.id === id
                    ? { ...c, intent, personal_goal: personalGoal }
                    : c
                )
              ),
            onLocalReconnectCardSent: (id) =>
              setContacts((current) =>
                current.map((c) =>
                  c.id === id
                    ? {
                        ...c,
                        reconnect_object_type: "manual",
                        has_open_reconnect_card: true,
                      }
                    : c
                )
              ),
          }}
        />
      ) : null}
    </div>
  );
}

function ContactSection({
  title,
  description,
  contacts,
  open,
  onToggle,
  onOpenContact,
  emptyMessage,
}: {
  title: string;
  description: string;
  contacts: ReconnectContact[];
  open: boolean;
  onToggle: () => void;
  onOpenContact: (id: string) => void;
  emptyMessage: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3 text-left transition-colors hover:bg-muted/35"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {open ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
            <span className="num-mono rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground">
              {contacts.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
      </button>

      {open ? (
        <ContactTable
          contacts={contacts}
          onOpenContact={onOpenContact}
          emptyMessage={emptyMessage}
        />
      ) : null}
    </section>
  );
}

function ContactTable({
  contacts,
  onOpenContact,
  emptyMessage,
}: {
  contacts: ReconnectContact[];
  onOpenContact: (id: string) => void;
  emptyMessage: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-sm">
        <thead className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Tier</th>
            <th className="px-3 py-2">Focus</th>
            <th className="px-3 py-2">Score</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Firm</th>
            <th className="px-3 py-2">Specialty</th>
            <th className="px-3 py-2">Last Contact</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {contacts.length ? (
            contacts.map((contact) => (
              <ContactRow
                key={contact.id}
                contact={contact}
                onOpenContact={onOpenContact}
              />
            ))
          ) : (
            <tr>
              <td colSpan={9} className="px-3 py-8 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ContactRow({
  contact,
  onOpenContact,
}: {
  contact: ReconnectContact;
  onOpenContact: (id: string) => void;
}) {
  const benched = isBench(contact);
  return (
    <tr
      onClick={() => onOpenContact(contact.id)}
      className={`cursor-pointer hover:bg-muted/30 ${benched ? "opacity-50 hover:opacity-100" : ""}`}
    >
      <td className="px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <TierBadge tier={contact.tier} />
          <IntentBadge intent={contact.intent} personalGoal={contact.personal_goal} />
        </div>
      </td>
      <td className="px-3 py-2">
        <FocusBadge rank={contact.firm_focus_rank} />
      </td>
      <td className="px-3 py-2">
        <ScoreChip score={contact.strategic_score} />
      </td>
      <td className="px-3 py-2">
        <div className="text-sm font-medium">{contact.name}</div>
        {contact.title ? (
          <div className="text-xs text-muted-foreground">{contact.title}</div>
        ) : null}
        {contact.personal_goal ? (
          <div className="mt-1 text-xs italic text-foreground/75">
            &ldquo;{contact.personal_goal}&rdquo;
          </div>
        ) : null}
      </td>
      <td className="px-3 py-2 text-muted-foreground">{contact.firm}</td>
      <td className="px-3 py-2 text-muted-foreground">{contact.specialty}</td>
      <td className="px-3 py-2 text-muted-foreground">
        {contact.last_contact_date ? (
          <>
            {formatDistanceToNow(new Date(contact.last_contact_date), { addSuffix: true })}
            {contact.touches[0]?.channel ? (
              <span className="text-muted-foreground"> · via {channelLabel(contact.touches[0].channel)}</span>
            ) : null}
          </>
        ) : (
          "No contact yet"
        )}
      </td>
      <td className="px-3 py-2">{RECRUITER_STATUS_LABELS[contact.state.status]}</td>
      <td className="px-3 py-2">
        <Button
          size="sm"
          variant="outline"
          onClick={(event) => {
            event.stopPropagation();
            onOpenContact(contact.id);
          }}
        >
          Open
        </Button>
      </td>
    </tr>
  );
}

function FilterGroup<T extends string>({
  values,
  selected,
  onToggle,
  label,
}: {
  values: T[];
  selected: T[];
  onToggle: (value: T) => void;
  label?: (value: T) => string;
}) {
  return (
    <div className="flex max-w-[420px] flex-wrap gap-1">
      {values.map((value) => {
        const active = selected.includes(value);
        return (
          <Button
            key={value}
            type="button"
            size="xs"
            variant={active ? "default" : "outline"}
            onClick={() => onToggle(value)}
          >
            {label ? label(value) : value}
          </Button>
        );
      })}
    </div>
  );
}

function channelLabel(channel: string): string {
  const map: Record<string, string> = {
    email: "email",
    linkedin: "LinkedIn",
    phone: "phone",
    meeting: "meeting",
    event: "event",
    referral: "referral",
    other: "other",
  };
  return map[channel] ?? channel;
}

function toggle<T extends string>(selected: T[], setSelected: (next: T[]) => void) {
  return (value: T) => {
    setSelected(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    );
  };
}
