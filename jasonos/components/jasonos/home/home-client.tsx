"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  BarChart3,
  ExternalLink,
  ArrowUpRight,
  PlugZap,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { OutreachModal } from "@/components/jasonos/outreach/outreach-modal";
import { TierDegreeBadge } from "@/components/jasonos/outreach/tier-degree-badge";
import { Logo } from "@/components/jasonos/logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { generateOutreachDraft } from "@/lib/server-actions/outreach-draft";
import { openBeeperText } from "@/lib/server-actions/beeper-compose";
import type { AttentionContact, HomeData, SitePanel } from "@/lib/data/home";

const COLUMN_LABEL: Record<string, string> = {
  network_growth: "Growth",
  network_maintenance: "Maintenance",
  browning_cold: "Cold",
  warm: "Growth",
  specific: "Growth",
  cold: "Cold",
};

type ModalMode = { contact: AttentionContact; tab: "engage" | "contact" };

export function HomeClient({
  data,
  children,
}: {
  data: HomeData;
  children?: React.ReactNode;
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
      const result = await generateOutreachDraft({ contactId: contact.id });
      if (!result.ok) {
        setDraftError(result.error);
        return;
      }
      setDraftText(result.draft);
    });
  };

  const writeText = async (contact: AttentionContact) => {
    if (textingId) return;
    setTextingId(contact.id);
    try {
      const result = await openBeeperText(contact.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      window.location.href = result.href;
      if (result.opened === "chat") {
        toast.success(
          result.chatTitle
            ? `Opening ${result.chatTitle} in Beeper on this Mac`
            : "Opening the chat in Beeper on this Mac"
        );
      } else if (result.gap === "missing_recipient") {
        toast.message(
          result.chatTitle
            ? `Opened Beeper. ${result.chatTitle} has no phone on file — search for them.`
            : "Opened Beeper. This contact has no phone on file — search for them."
        );
      } else {
        toast.message(
          result.chatTitle
            ? `Opened Beeper. Find ${result.chatTitle} in the chat list.`
            : "Opened Beeper. Find them in the chat list."
        );
      }
    } finally {
      setTextingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <header className="flex items-center gap-3">
        <Logo size={36} />
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Home</h1>
          <p className="text-xs text-muted-foreground">
            Overdue outreach and site traffic.
          </p>
        </div>
      </header>

      {children}

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center gap-2 bg-red-700/70 px-4 py-2.5 text-white">
          <AlertCircle className="h-4 w-4" />
          <h2 className="text-sm font-semibold tracking-tight">Overdue</h2>
          <span className="ml-auto rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-medium tabular-nums">
            {data.overdue.length}
          </span>
        </div>
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
            {data.overdue.map((c) => (
              <li
                key={c.id}
                className="flex min-h-[4.125rem] flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <TierDegreeBadge tier={c.tier} degree={c.degree} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {c.name}
                      {c.firm ? (
                        <span className="ml-1.5 text-[11px] text-muted-foreground">
                          · {c.firm}
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      <span className="rounded-sm border border-border px-1 py-0.5 text-[9px] uppercase tracking-wider">
                        {COLUMN_LABEL[c.column] ?? c.column}
                      </span>
                      <span className="ml-1.5 text-red-300">
                        {c.daysOverdue}d overdue
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openContact(c)}
                  >
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => logContact(c)}
                  >
                    Log
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-tight">Site traffic</h2>
          <span className="text-[11px] text-muted-foreground">last 30 days</span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {data.sites.map((s) => (
            <TrafficPanel key={s.key} site={s} />
          ))}
        </div>
      </section>

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
              Writing a draft…
            </p>
          ) : draftError ? (
            <p className="py-4 text-sm text-red-300">{draftError}</p>
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

function TrafficPanel({ site }: { site: SitePanel }) {
  const t = site.traffic;
  return (
    <section className="flex flex-col overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <h3 className="text-sm font-semibold tracking-tight">{site.label}</h3>
        {site.url ? (
          <a
            href={site.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
            title={site.url}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>

      {!t.configured ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-4 py-8 text-center">
          <PlugZap className="h-6 w-6 text-muted-foreground/50" />
          <p className="text-xs font-medium">Connect Web Analytics</p>
          <p className="text-[11px] text-muted-foreground">
            Add the Vercel token + this project&rsquo;s ID to show traffic.
          </p>
        </div>
      ) : !t.ok ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-4 py-8 text-center">
          <AlertCircle className="h-6 w-6 text-amber-400/70" />
          <p className="text-[11px] text-muted-foreground">{t.error}</p>
        </div>
      ) : (
        <div className="flex-1 space-y-3 p-4">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Visitors" value={t.visitors} />
            <Stat label="Page views" value={t.pageViews} />
          </div>

          <TrafficList
            title="Top pages"
            rows={t.topPages.map((p) => ({
              label: p.path,
              value: p.pageViews,
            }))}
          />
          <TrafficList
            title="Top referrers"
            rows={t.topReferrers.map((r) => ({
              label: r.referrer,
              value: r.pageViews,
            }))}
          />
          {t.topEvents.length > 0 ? (
            <TrafficList
              title="What they do (events)"
              rows={t.topEvents.map((e) => ({ label: e.name, value: e.count }))}
            />
          ) : null}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-background/60 p-2.5">
      <p className="flex items-center gap-1 text-xl font-semibold tabular-nums leading-none">
        <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
        {value.toLocaleString()}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function TrafficList({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number }[];
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <ul className="space-y-0.5">
        {rows.map((r, i) => (
          <li
            key={`${r.label}-${i}`}
            className="flex items-center justify-between gap-2 text-[11px]"
          >
            <span className="min-w-0 truncate text-foreground/80">{r.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {r.value.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
