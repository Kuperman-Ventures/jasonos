"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import {
  AlertCircle,
  ChevronDown,
  Clock,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { OutreachModal } from "@/components/jasonos/outreach/outreach-modal";
import { ContactAvatar } from "@/components/jasonos/outreach/contact-avatar";
import { TierDegreeBadge } from "@/components/jasonos/outreach/tier-degree-badge";
import { Logo } from "@/components/jasonos/logo";
import { PageHeader } from "@/components/jasonos/brand/page-header";
import {
  StatusBand,
  StatusPill,
  type StatusRung,
} from "@/components/jasonos/brand/status";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  confirmBeeperTextSent,
  openBeeperText,
} from "@/lib/server-actions/beeper-compose";
import { nativeMessagesHref } from "@/lib/integrations/beeper-links";
import type { AttentionContact, HomeData } from "@/lib/data/home";
import { useRouter } from "next/navigation";

const COLUMN_LABEL: Record<string, string> = {
  network_growth: "Growth",
  network_maintenance: "Maintenance",
  browning_cold: "Cold",
  warm: "Growth",
  specific: "Growth",
  cold: "Cold",
};

type ModalMode = { contact: AttentionContact; tab: "engage" | "contact" };

function dueLabel(daysUntilDue: number): string {
  if (daysUntilDue <= 0) return "due today";
  if (daysUntilDue === 1) return "due tomorrow";
  return `in ${daysUntilDue}d`;
}

export function HomeClient({
  data,
  children,
  bottom,
}: {
  data: HomeData;
  children?: React.ReactNode;
  /** Rendered after Networking Due this Week / Networking Overdue (page bottom). */
  bottom?: React.ReactNode;
}) {
  const [target, setTarget] = useState<ModalMode | null>(null);
  const [draftFor, setDraftFor] = useState<AttentionContact | null>(null);
  const [draftText, setDraftText] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [drafting, startDraft] = useTransition();
  const [textingId, setTextingId] = useState<string | null>(null);

  const openContact = (contact: AttentionContact) => {
    setTarget({ contact, tab: "contact" });
  };

  const logContact = (contact: AttentionContact) => {
    setTarget({ contact, tab: "engage" });
  };

  const draftEmail = (contact: AttentionContact) => {
    setDraftFor(contact);
    setDraftText(null);
    setDraftError(null);
    startDraft(async () => {
      try {
        const res = await fetch("/api/outreach/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId: contact.id }),
        });
        const result = (await res.json()) as
          | { ok: true; draft: string }
          | { ok: false; error?: string };
        if (!result.ok) {
          setDraftError(result.error ?? "Couldn't write the draft.");
          return;
        }
        setDraftText(result.draft);
      } catch {
        setDraftError("Couldn't reach the draft writer.");
      }
    });
  };

  const router = useRouter();

  const markTextSent = async (contact: AttentionContact) => {
    const result = await confirmBeeperTextSent(contact.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (result.clearedOverdue || result.touchesLogged > 0) {
      toast.success(
        result.source === "beeper"
          ? `Logged ${result.touchesLogged} Beeper text${result.touchesLogged === 1 ? "" : "s"} · overdue cleared`
          : "Logged today’s text · overdue cleared"
      );
      router.refresh();
      return;
    }
    toast.message("Touch logged.");
    router.refresh();
  };

  const writeText = (contact: AttentionContact) => {
    if (textingId) return;
    const messagesHref = nativeMessagesHref(contact.phone);
    if (messagesHref) {
      // Must run in the click itself. After await, Chrome/Safari drop the
      // user gesture and imessage:/sms: do nothing.
      window.location.href = messagesHref;
    } else {
      toast.error(
        `No phone on ${contact.name}'s card. Add one, then Text opens Messages.`
      );
    }
    setTextingId(contact.id);
    void (async () => {
      try {
        const result = await openBeeperText(contact.id);
        if (!result.ok) {
          if (!messagesHref) toast.error(result.error);
          return;
        }
        const clearedOverdue = result.clearedOverdue;
        const touchesLogged = result.touchesLogged;
        const chatTitle = result.chatTitle;

        if (clearedOverdue || touchesLogged > 0) {
          toast.success(
            chatTitle
              ? `Opened ${chatTitle} · logged Beeper text · overdue cleared`
              : "Logged Beeper text · overdue cleared"
          );
          router.refresh();
          return;
        }
        if (messagesHref) {
          toast.success(
            chatTitle ? `Opened ${chatTitle} in Messages` : "Opened Messages",
            {
              description:
                "Send in iMessage. Beeper will pick it up; then click I sent it.",
              action: {
                label: "I sent it",
                onClick: () => {
                  void markTextSent(contact);
                },
              },
              duration: 20_000,
            }
          );
          return;
        }
        toast.success("Opened Beeper. Find them in the chat list.", {
          description: "After you send, click I sent it to clear overdue.",
          action: {
            label: "I sent it",
            onClick: () => {
              void markTextSent(contact);
            },
          },
          duration: 20_000,
        });
      } finally {
        setTextingId(null);
      }
    })();
  };

  const renderRow = (
    c: AttentionContact,
    timing: { kind: "overdue" } | { kind: "due"; label: string }
  ) => {
    const dueToday = timing.kind === "due" && c.daysUntilDue <= 0;
    return (
    <li
      key={c.id}
      className="flex min-h-[4.125rem] flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <ContactAvatar name={c.name} photoUrl={c.photoUrl} size="md" />
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1.5 truncate font-medium">
            <span className="truncate">{c.name}</span>
            <TierDegreeBadge tier={c.tier} degree={c.degree} />
            {c.firm ? (
              <span className="truncate text-[11px] font-normal text-muted-foreground">
                · {c.firm}
              </span>
            ) : null}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            <span className="rounded-sm border border-border px-1 py-0.5 text-[9px] uppercase tracking-wider">
              {COLUMN_LABEL[c.column] ?? c.column}
            </span>
            {timing.kind === "overdue" ? (
              <span className="ml-1.5 inline-flex items-center rounded-[2px] bg-rung-1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                {`${c.daysOverdue}d overdue`}
              </span>
            ) : dueToday ? (
              <span className="ml-1.5 inline-flex items-center rounded-[2px] bg-rung-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                Due today
              </span>
            ) : (
              <span className="ml-1.5 text-rung-ink">{timing.label}</span>
            )}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0">
        <Button variant="outline" size="sm" onClick={() => openContact(c)}>
          Open
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => draftEmail(c)}
          disabled={drafting && draftFor?.id === c.id}
        >
          {drafting && draftFor?.id === c.id ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : null}
          Draft email
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void writeText(c)}
          disabled={textingId === c.id}
        >
          {textingId === c.id ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : null}
          Text
        </Button>
        <Button variant="outline" size="sm" onClick={() => logContact(c)}>
          Log
        </Button>
      </div>
    </li>
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <PageHeader
        mark={<Logo size={40} />}
        title="Home"
        description="Due this week, overdue outreach, sent-mail follow-ups, and commitments."
      />

      {children}

      <CollapsibleHomeBand
        storageKey="jasonos.due-this-week.collapsed"
        label="Networking Due this Week"
        rung={2}
        icon={<Clock className="h-5 w-5" />}
        count={data.dueThisWeek.length}
      >
        <p className="border-b px-4 py-1.5 text-[11px] text-muted-foreground">
          Due today or by Friday. Open, draft, text, or log from here.
        </p>
        {data.dueThisWeek.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            Nobody due this week.
          </p>
        ) : (
          <ul className="max-h-[calc(10*4.125rem)] divide-y divide-border overflow-y-auto overscroll-contain">
            {data.dueThisWeek.map((c) =>
              renderRow(c, {
                kind: "due",
                label: dueLabel(c.daysUntilDue),
              })
            )}
          </ul>
        )}
      </CollapsibleHomeBand>

      <CollapsibleHomeBand
        storageKey="jasonos.overdue.collapsed"
        label="Networking Overdue"
        rung={1}
        icon={<AlertCircle className="h-5 w-5" />}
        count={data.overdue.length}
      >
        <p className="border-b px-4 py-1.5 text-[11px] text-muted-foreground">
          Past their next-touch date. Open, draft, text, or log from here.
        </p>
        {/* Queue-style window: ~10 rows visible, the rest scroll inside. */}
        {data.overdue.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            Nothing overdue. Clear.
          </p>
        ) : (
          <ul className="max-h-[calc(10*4.125rem)] divide-y divide-border overflow-y-auto overscroll-contain">
            {data.overdue.map((c) => renderRow(c, { kind: "overdue" }))}
          </ul>
        )}
      </CollapsibleHomeBand>

      {bottom}

      <OutreachModal
        open={!!target}
        onOpenChange={(o) => {
          if (!o) setTarget(null);
        }}
        contactId={target?.contact.id}
        initialTab={target?.tab}
        initialDisplay={
          target
            ? {
                name: target.contact.name,
                title: target.contact.title,
                firm: target.contact.firm,
              }
            : undefined
        }
      />

      <Dialog
        open={!!draftFor}
        onOpenChange={(o) => {
          if (!o) {
            setDraftFor(null);
            setDraftText(null);
            setDraftError(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Draft for {draftFor?.name ?? "this contact"}
            </DialogTitle>
            <DialogDescription>
              {draftFor?.email
                ? `Opens mail to ${draftFor.email}.`
                : "No email on file. Copy the draft and send it wherever you write."}
            </DialogDescription>
          </DialogHeader>
          {drafting && !draftText && !draftError ? (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Reading emails and Granola notes with them…
            </p>
          ) : draftError ? (
            <p className="py-4 text-sm text-rung-1">{draftError}</p>
          ) : draftText ? (
            <div className="space-y-3">
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border bg-background/60 p-3 text-sm">
                {draftText}
              </pre>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(draftText);
                    toast.success("Draft copied");
                  }}
                >
                  Copy
                </Button>
                {draftFor?.email ? (
                  <Button
                    size="sm"
                    variant="outline"
                    render={
                      <a
                        href={`mailto:${draftFor.email}?body=${encodeURIComponent(draftText)}`}
                      />
                    }
                  >
                    Open in email
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CollapsibleHomeBand({
  storageKey,
  label,
  rung,
  icon,
  count,
  children,
}: {
  storageKey: string;
  label: string;
  rung: StatusRung;
  icon: ReactNode;
  count: number;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    // Default collapsed; only expand if Jason previously chose open.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.localStorage.getItem(storageKey) === "0") setCollapsed(false);
    } catch {
      // private mode / quota
    }
  }, [storageKey]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <section className="overflow-hidden">
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
        aria-label={collapsed ? `Expand ${label}` : `Collapse ${label}`}
        className="w-full text-left"
      >
        <StatusBand rung={rung}>
          {icon}
          <h2 className="text-[17px] font-bold tracking-tight">{label}</h2>
          <StatusPill rung={4} className="ml-auto">
            {count}
          </StatusPill>
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${
              collapsed ? "-rotate-90" : ""
            }`}
          />
        </StatusBand>
      </button>
      {!collapsed ? children : null}
    </section>
  );
}
