"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Mail,
  MessageSquare,
  Phone,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CommChannel,
  CommunicationsContact,
  CommUrgency,
} from "@/lib/server-actions/communications";

type ScheduleUrgency = Extract<
  CommUrgency,
  "sent_today" | "due_today" | "this_week" | "scheduled"
>;

const SCHEDULE_URGENCIES: ScheduleUrgency[] = [
  "sent_today",
  "due_today",
  "this_week",
  "scheduled",
];

const URGENCY_CONFIG: Record<
  ScheduleUrgency,
  {
    label: string;
    helper: string;
    icon: React.ReactNode;
    textColor: string;
    headerBg: string;
  }
> = {
  sent_today: {
    label: "Engaged Today",
    helper: "Outbound touches recorded today",
    icon: <Mail className="h-4 w-4" />,
    textColor: "text-emerald-300",
    headerBg: "bg-emerald-700/70",
  },
  due_today: {
    label: "Overdue",
    helper: "Due today or past next-touch date",
    icon: <AlertCircle className="h-4 w-4" />,
    textColor: "text-red-300",
    headerBg: "bg-red-700/80",
  },
  this_week: {
    label: "Due This Week",
    helper: "Scheduled for outreach in the next 7 days",
    icon: <Clock className="h-4 w-4" />,
    textColor: "text-amber-300",
    headerBg: "bg-amber-600/70",
  },
  scheduled: {
    label: "Scheduled",
    helper: "Next touch set after this week",
    icon: <Calendar className="h-4 w-4" />,
    textColor: "text-sky-300",
    headerBg: "bg-sky-800/50",
  },
};

const CHANNEL_ICONS: Record<CommChannel, React.ReactNode> = {
  email: <Mail className="h-3.5 w-3.5" />,
  linkedin: <MessageSquare className="h-3.5 w-3.5" />,
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

export function ScheduleUrgencyGrid({
  contacts,
  searchQuery,
  onContactClick,
}: {
  contacts: CommunicationsContact[];
  searchQuery: string;
  onContactClick: (contact: CommunicationsContact) => void;
}) {
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const searchable = q
      ? contacts.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.firm ?? "").toLowerCase().includes(q)
        )
      : contacts;

    return SCHEDULE_URGENCIES.reduce<Record<ScheduleUrgency, CommunicationsContact[]>>(
      (acc, urgency) => {
        acc[urgency] = searchable.filter((c) => c.urgency === urgency);
        return acc;
      },
      {
        sent_today: [],
        due_today: [],
        this_week: [],
        scheduled: [],
      }
    );
  }, [contacts, searchQuery]);

  const total = SCHEDULE_URGENCIES.reduce(
    (sum, urgency) => sum + filtered[urgency].length,
    0
  );

  return (
    <section className="rounded-xl border bg-card/30">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">
            Outreach Schedule
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Schedule buckets from the Outreach grid, spanning the Queue columns.
          </p>
        </div>
        <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {total} scheduled
        </span>
      </header>

      <div className="grid grid-cols-1 divide-y md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-4">
        {SCHEDULE_URGENCIES.map((urgency) => (
          <ScheduleUrgencyColumn
            key={urgency}
            urgency={urgency}
            contacts={filtered[urgency]}
            onContactClick={onContactClick}
          />
        ))}
      </div>
    </section>
  );
}

function ScheduleUrgencyColumn({
  urgency,
  contacts,
  onContactClick,
}: {
  urgency: ScheduleUrgency;
  contacts: CommunicationsContact[];
  onContactClick: (contact: CommunicationsContact) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const cfg = URGENCY_CONFIG[urgency];
  const useRows = urgency === "scheduled";

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left",
          cfg.headerBg
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className={cfg.textColor}>{cfg.icon}</span>
          <div className="min-w-0">
            <div className={cn("text-sm font-semibold", cfg.textColor)}>
              {cfg.label}
            </div>
            <div className="truncate text-[11px] text-white/60">
              {cfg.helper}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs font-medium text-white/80">
            {contacts.length}
          </span>
          {collapsed ? (
            <ChevronDown className="h-4 w-4 text-white/60" />
          ) : (
            <ChevronUp className="h-4 w-4 text-white/60" />
          )}
        </div>
      </button>

      {!collapsed ? (
        useRows ? (
          <div className="max-h-52 overflow-y-auto divide-y divide-border/30 bg-card/10">
            {contacts.length ? (
              contacts.map((contact) => (
                <ContactRow
                  key={contact.id}
                  contact={contact}
                  onContactClick={onContactClick}
                />
              ))
            ) : (
              <EmptyBucket />
            )}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto bg-card/20 px-3 py-3">
            {contacts.length ? (
              contacts.map((contact) => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  onContactClick={onContactClick}
                />
              ))
            ) : (
              <EmptyBucket />
            )}
          </div>
        )
      ) : null}
    </div>
  );
}

function ContactRow({
  contact,
  onContactClick,
}: {
  contact: CommunicationsContact;
  onContactClick: (contact: CommunicationsContact) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onContactClick(contact)}
      className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/30"
    >
      <div className="min-w-0 flex-1">
        <span className="text-xs font-medium">{contact.name}</span>
        {contact.firm ? (
          <span className="ml-1.5 text-[10px] text-muted-foreground">
            · {contact.firm}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {contact.nextActionDueDate ? (
          <span className="text-[10px] text-sky-400">
            {fmtDate(contact.nextActionDueDate)}
          </span>
        ) : contact.lastTouch ? (
          <span className="text-[10px] text-muted-foreground">
            {CHANNEL_LABELS[contact.lastTouch.channel]} ·{" "}
            {fmtDate(contact.lastTouch.touched_at)}
          </span>
        ) : null}
        <StrengthDots strength={contact.strength} />
      </div>
    </button>
  );
}

function ContactCard({
  contact,
  onContactClick,
}: {
  contact: CommunicationsContact;
  onContactClick: (contact: CommunicationsContact) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onContactClick(contact)}
      className="h-[90px] w-[130px] shrink-0 rounded-lg border border-border/60 bg-card p-2.5 text-left transition-colors hover:border-foreground/40"
    >
      <div className="line-clamp-2 text-xs font-medium leading-tight">
        {contact.name}
      </div>
      <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
        {contact.firm ?? "-"}
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

function EmptyBucket() {
  return (
    <div className="px-3 py-3 text-xs italic text-muted-foreground">
      No contacts in this bucket
    </div>
  );
}

function StrengthDots({ strength }: { strength: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            i < strength ? "bg-foreground/70" : "bg-muted-foreground/20"
          )}
        />
      ))}
    </div>
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
