"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronDown, Sunrise, Plus, X, RefreshCw, Calendar, Mail, Mic, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { useMorningBrief } from "@/hooks/dashboard/use-morning-brief";
import { BriefSection } from "./brief-section";
import { BriefItem } from "./brief-item";
import { MustDos } from "../must-dos";
import { PrepSheet } from "./prep-sheet";
import type { CalendarEvent } from "@/lib/integrations/google-calendar";
import type { CrunchbaseHit } from "@/lib/integrations/crunchbase";

const FEATURE_FLAG = process.env.NEXT_PUBLIC_MORNING_BRIEF_ENABLED;
const ENABLED = FEATURE_FLAG === undefined ? true : FEATURE_FLAG !== "false";

const MORNING_END_HOUR = 12;
const MORNING_START_HOUR = 5;

function isMorningWindow(): boolean {
  const h = new Date().getHours();
  return h >= MORNING_START_HOUR && h < MORNING_END_HOUR;
}

export function MorningBrief() {
  const { status, data, error, refresh, removeIcpHit } = useMorningBrief();
  const [collapsed, setCollapsed] = useState<boolean>(!isMorningWindow());
  const [prepEvent, setPrepEvent] = useState<CalendarEvent | null>(null);

  // Cmd/Ctrl+M opens/focuses the Morning Brief.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "m" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        setCollapsed(false);
        document.getElementById("morning-brief")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const today = useMemo(() => format(new Date(), "EEEE, MMM d"), []);

  if (!ENABLED) return null;

  if (collapsed) {
    return (
      <div id="morning-brief" className="flex justify-start">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCollapsed(false)}
          className="h-8 gap-2 text-xs"
        >
          <Sunrise className="h-3.5 w-3.5 text-rung-ink" />
          View morning brief
          <kbd className="ml-1 inline-flex items-center rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            ⌘M
          </kbd>
        </Button>
      </div>
    );
  }

  const overnight = data?.overnight;
  const calendar = data?.calendar;
  const icp = data?.icpHits;

  const gmailLive = !!overnight?.gmail.configured;
  const calendarLive = !!calendar?.configured;
  const meetingsLive = !!(overnight?.granola.configured || overnight?.fireflies.configured);
  const icpLive = !!icp?.configured;
  const instantlyLive = !!overnight?.instantly.configured;

  const allReplies = [
    ...(overnight?.gmail.data ?? []),
    ...((overnight?.instantly.data?.repliesSinceCutoff ?? []).map((r) => ({
      id: `instantly-${r.id}`,
      threadId: r.id,
      fromEmail: r.fromEmail,
      fromName: r.fromName,
      subject: r.subject,
      snippet: r.preview ?? "",
      receivedAt: r.receivedAt,
      summary: r.sequenceName ? `via ${r.sequenceName}` : undefined,
    }))),
  ].sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));

  const meetings = [
    ...(overnight?.granola.data ?? []),
    ...(overnight?.fireflies.data ?? []),
  ].sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt));

  const events = calendar?.data ?? [];

  const isLoading = status === "loading";

  return (
    <section
      id="morning-brief"
      className="rounded-xl border bg-card"
    >
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <Sunrise className="h-4 w-4 text-rung-ink" />
        <h2 className="text-sm font-semibold tracking-tight">Morning Brief</h2>
        <span className="text-[11px] text-muted-foreground">· {today}</span>
        {status === "ready" ? (
          <span className="text-[10px] text-muted-foreground">
            · generated {format(new Date(data!.generatedAt), "h:mm a")}
          </span>
        ) : null}
        {status === "error" ? (
          <span className="text-[10px] text-rung-1">· {error}</span>
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => {
              void refresh();
              toast.info("Refreshing morning brief");
            }}
          >
            <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => setCollapsed(true)}
            aria-label="Collapse morning brief"
          >
            <ChevronDown className="h-3 w-3 -rotate-180" />
            Hide
          </Button>
        </div>
      </header>

      <div className="space-y-3 p-3">
        <BriefSection
          title="Overnight"
          source={
            gmailLive || meetingsLive || instantlyLive
              ? [gmailLive && "Gmail", instantlyLive && "Instantly", meetingsLive && "Meetings"]
                  .filter(Boolean)
                  .join(" + ")
              : "not connected"
          }
          liveBadge={gmailLive || meetingsLive || instantlyLive}
          count={allReplies.length + meetings.length}
          isEmpty={!isLoading && allReplies.length === 0 && meetings.length === 0}
          emptyState="Quiet night. No new replies, no meetings recorded."
        >
          <div className="space-y-3">
            {allReplies.length ? (
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  Replies · {allReplies.length}
                </div>
                <div className="space-y-1.5">
                  {allReplies.slice(0, 3).map((r) => (
                    <BriefItem
                      key={r.id}
                      title={r.fromName ?? r.fromEmail}
                      subtitle={r.subject}
                      detail={r.summary ?? r.snippet}
                      meta={format(new Date(r.receivedAt), "h:mm a")}
                      actions={
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[10px]"
                          onClick={() =>
                            toast.success(`Reply queued → ${r.fromName ?? r.fromEmail}`, {
                              description: "Stub — wires to /api/email/reply.",
                            })
                          }
                        >
                          Reply
                        </Button>
                      }
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {meetings.length ? (
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <Mic className="h-3 w-3" />
                  Meetings recorded · {meetings.length}
                </div>
                <div className="space-y-1.5">
                  {meetings.slice(0, 3).map((m) => (
                    <BriefItem
                      key={`${m.source}-${m.id}`}
                      title={m.title}
                      subtitle={m.source === "granola" ? "Granola" : "Fireflies"}
                      detail={m.summary}
                      meta={format(new Date(m.endedAt), "MMM d, h:mm a")}
                      actions={
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => {
                            const url =
                              "notesUrl" in m ? m.notesUrl :
                              "transcriptUrl" in m ? m.transcriptUrl : undefined;
                            if (url) window.open(url, "_blank");
                            else toast.info("No notes URL on this meeting");
                          }}
                        >
                          Open notes
                        </Button>
                      }
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </BriefSection>

        <BriefSection
          title="Today's Calendar"
          source={calendarLive ? "Google Calendar" : "not connected"}
          liveBadge={calendarLive}
          count={events.length}
          isEmpty={!isLoading && events.length === 0}
          emptyState="Nothing on the calendar today."
        >
          <div className="space-y-1.5">
            {events.map((e, idx) => {
              const startTime = format(new Date(e.startsAt), "h:mm a");
              const isFirst = idx === 0;
              return (
                <BriefItem
                  key={e.id}
                  accent={isFirst ? "amber" : "muted"}
                  title={e.title}
                  subtitle={
                    e.attendees.length
                      ? `${e.attendees.length} attendee${e.attendees.length === 1 ? "" : "s"}`
                      : "No attendees"
                  }
                  meta={startTime}
                  detail={
                    e.attendees
                      .filter((a) => !a.isMe)
                      .slice(0, 4)
                      .map((a) => a.name ?? a.email)
                      .join(", ") || undefined
                  }
                  actions={
                    isFirst ? (
                      <Button
                        size="sm"
                        className="h-6 gap-1 px-2 text-[10px]"
                        onClick={() => setPrepEvent(e)}
                      >
                        <Calendar className="h-3 w-3" />
                        Prep
                      </Button>
                    ) : undefined
                  }
                />
              );
            })}
          </div>
        </BriefSection>

        <BriefSection
          title="Fresh ICP Hits"
          subtitle="Crunchbase Daily · ICP-filtered"
          source={icpLive ? "Crunchbase" : "Crunchbase not connected"}
          liveBadge={icpLive}
          count={icp?.data.length ?? 0}
          isEmpty={!isLoading && (icp?.data.length ?? 0) === 0}
          emptyState="No new ICP-passing rounds overnight."
        >
          <div className="space-y-1.5">
            {(icp?.data ?? []).map((h) => (
              <IcpHitRow
                key={h.id}
                hit={h}
                onAdded={() => removeIcpHit(h.id)}
                onDismissed={() => removeIcpHit(h.id)}
              />
            ))}
          </div>
        </BriefSection>

        <BriefSection
          title="Today's Focus"
          subtitle="Top must-dos"
          defaultOpen={true}
        >
          <MustDos variant="compact" limit={5} showHeader={false} className="border-0 bg-transparent" />
        </BriefSection>
      </div>

      <PrepSheet
        event={prepEvent}
        open={!!prepEvent}
        onOpenChange={(o) => {
          if (!o) setPrepEvent(null);
        }}
      />
    </section>
  );
}

function IcpHitRow({
  hit,
  onAdded,
  onDismissed,
}: {
  hit: CrunchbaseHit;
  onAdded: () => void;
  onDismissed: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const raise = `$${(hit.raiseUsd / 1_000_000).toFixed(0)}M`;
  return (
    <BriefItem
      accent="emerald"
      title={hit.name}
      subtitle={`${hit.stage} · ${raise}`}
      detail={hit.fitRationale}
      meta={`fit ${(hit.fitScore * 100).toFixed(0)}%`}
      actions={
        <>
          <Button
            size="sm"
            disabled={busy}
            className="h-6 gap-1 px-2 text-[10px]"
            onClick={async () => {
              setBusy(true);
              onAdded();
              try {
                const res = await fetch("/api/action-queue/add", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    source: "crunchbase",
                    track: "advisors",
                    title: `${hit.name} — ${hit.stage}, ${raise}`,
                    subtitle: hit.fitRationale,
                    template: hit.suggestedTemplate,
                    whyNow: `Funded ${raise} (${hit.stage}) · ICP fit ${(hit.fitScore * 100).toFixed(0)}%`,
                    module: "morning_brief_crunchbase",
                    externalRefs: hit.sourceUrl ? { crunchbase_url: hit.sourceUrl } : {},
                    priorityScore: hit.fitScore,
                  }),
                });
                const j = await res.json();
                if (!j.ok) throw new Error(j.error ?? "add failed");
                toast.success(`Added ${hit.name} to Action Queue`, {
                  description: j.persisted ? undefined : j.note,
                });
              } catch (err) {
                toast.error(`Failed: ${err instanceof Error ? err.message : err}`);
              }
            }}
          >
            <Plus className="h-3 w-3" />
            Add to Queue
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            className="h-6 gap-1 px-2 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={() => {
              onDismissed();
              toast.info(`Dismissed ${hit.name}`);
            }}
          >
            <X className="h-3 w-3" />
            Dismiss
          </Button>
        </>
      }
    />
  );
}

// Re-export for type-only consumers; avoids "unused-import" if Building2 is dropped.
export const _MorningBriefIcons = { Building2 };
