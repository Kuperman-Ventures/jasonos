"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarBlank, LockSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CollapsibleSection,
  LIVE_FIELD,
  LIVE_SECTION_LABEL,
  LeaveGuardProvider,
  LiveTertiaryNav,
  SavedTextField,
  useLeaveGuard,
  type SaveOutcome,
} from "@/components/jasonos/live";
import { CallSheetDebrief } from "@/components/jasonos/meeting-prep/call-sheet-debrief";
import { LiveCallClient } from "@/components/jasonos/meeting-prep/live-call-client";
import { PointsEditor } from "@/components/jasonos/meeting-prep/points-editor";
import { RehearseSheetClient, scriptItemsAsPoints } from "@/components/jasonos/meeting-prep/rehearse-client";
import {
  AfterBlockBody,
  AskBlockBody,
  BlockFrame,
  ConversationBlockBody,
  LinesBlockBody,
  ReadyButton,
  SheetRail,
  TextBlockBody,
  WhoBlockBody,
} from "@/components/jasonos/meeting-prep/call-sheet-blocks";
import { easternClock, ExternalLink, joinHref } from "@/components/jasonos/meeting-prep/meeting-prep-bits";
import {
  blockIsFilled,
  blockMinutes,
  callNumberLabel,
  readyProblem,
  suggestedFamily,
  unsavedProblem,
  type CallSheetBlock,
} from "@/lib/meeting-prep/call-sheet";
import { easternDateLong, type MeetingContext, type MeetingContextPerson } from "@/lib/meeting-prep/context-model";
import { buildLiveSheet } from "@/lib/meeting-prep/live-sheet";
import { FAMILY_LABELS, type PlaybookFamily } from "@/lib/meeting-prep/playbook-blocks";
import type { PointState } from "@/lib/meeting-prep/points";
import type { ReactionShape } from "@/lib/meeting-prep/reactions";
import {
  buildCallSheet,
  createCallSheet,
  markSheetReady,
  putSheetOnMeeting,
  type CallSheet,
  type CallSheetPerson,
} from "@/lib/server-actions/call-sheet";
import {
  createLiveScriptItem,
  deleteLiveScript,
  deleteLiveScriptItem,
  draftScriptItemReactions,
  reorderLiveScriptItems,
  updateLiveScript,
  updateLiveScriptItem,
  type LiveScript,
  type LiveScriptItem,
} from "@/lib/server-actions/live-scripts";
import {
  endLiveMeeting,
  setMeetingPointNote,
  setMeetingPointObservedReaction,
  setMeetingPointState,
  startLiveMeeting,
  type MeetingPoint,
} from "@/lib/server-actions/meeting-points";
import {
  setMeetingOutcomeMark,
  type MeetingPrepDetail,
  type MeetingPrepSummary,
  type OutcomeMark,
} from "@/lib/server-actions/meeting-prep";
import type { MeetingReview } from "@/lib/server-actions/meeting-reviews";
import type { RelationshipLogEntry } from "@/lib/server-actions/person";
import { cn } from "@/lib/utils";

export type CallSheetView = "read" | "rehearse" | "live" | "debrief";

const LINK = "text-[14px] font-semibold text-[var(--color-accent-700)] hover:underline";
const KICKER =
  "inline-flex flex-wrap items-center gap-x-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--color-calendar-700)]";

function etDateKey(ms: number): string {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function etDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function countdown(startsAt: string, endsAt: string, now: number): string | null {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  if (now >= start && now <= end) return "Now";
  if (now > end) return etDateKey(start) === etDateKey(now) ? "Ended" : null;
  const mins = Math.round((start - now) / 60000);
  if (mins < 1) return "Starting";
  if (mins < 60) return `In ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `In ${hours} hr`;
  const days = Math.round(hours / 24);
  return days === 1 ? "In 1 day" : `In ${days} days`;
}

function kickerParts(prep: MeetingPrepDetail, now: number | null, callLabel: string | null): string[] {
  let when = etDay(prep.startsAt);
  if (now != null) {
    const day = etDateKey(Date.parse(prep.startsAt));
    if (day === etDateKey(now)) when = "Today";
    else if (day === etDateKey(now + 86_400_000)) when = "Tomorrow";
  }
  const parts = [when, easternClock(prep.startsAt)];
  const left = now == null ? null : countdown(prep.startsAt, prep.endsAt, now);
  if (left) parts.push(left);
  if (callLabel) parts.push(callLabel);
  return parts;
}

function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function primaryOf(prep: MeetingPrepDetail, context: MeetingContext): MeetingContextPerson | null {
  return (
    context.people.find((person) => person.contactId === prep.primaryContactId) ?? context.people[0] ?? null
  );
}

function scrollToBlock(block: CallSheetBlock) {
  document.getElementById(`block-${block.key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const STATUS_LABELS: Record<string, string> = {
  referral: "Referral",
  first_contacted: "First contact",
  call_1: "After call 1",
  call_2: "After call 2",
  call_3: "After call 3",
};

/* ---------- 4a. Playbook picker ---------- */

const CARD_FAMILIES: PlaybookFamily[] = ["net102_first", "net102_second", "advisors"];

function playbookFor(playbooks: LiveScript[], family: PlaybookFamily): LiveScript | null {
  return playbooks.find((playbook) => playbook.family === family) ?? null;
}

function PlaybookCard({
  playbook,
  suggested,
  blank,
  busy,
  disabled,
  onStart,
}: {
  playbook: LiveScript;
  suggested: boolean;
  blank: boolean;
  busy: boolean;
  disabled: boolean;
  onStart: () => void;
}) {
  const meta = blank
    ? "Your own blocks. Who, the conversation, the ask, after."
    : [
        `${playbook.blocks.length} block${playbook.blocks.length === 1 ? "" : "s"}`,
        playbook.itemCount ? `${playbook.itemCount} point${playbook.itemCount === 1 ? "" : "s"}` : null,
        playbook.useCount ? `used ${playbook.useCount}×` : null,
      ]
        .filter(Boolean)
        .join(" · ");
  return (
    <li
      className={cn(
        "flex min-h-[200px] flex-col border p-5",
        suggested ? "border-2 border-[var(--color-accent-700)]" : "border-[var(--jos-line)]"
      )}
    >
      {suggested ? (
        <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--color-accent-700)]">Suggested</p>
      ) : null}
      <h3 className={cn("text-[20px] font-extrabold leading-tight tracking-[-0.01em]", suggested && "mt-1")}>
        {blank ? "Blank" : playbook.name}
      </h3>
      {playbook.description && !blank ? (
        <p className="mt-2 line-clamp-3 text-[15px] leading-snug text-[var(--jos-muted)]">{playbook.description}</p>
      ) : null}
      <p className="mt-2 text-[13px] text-[var(--jos-muted)]">{meta}</p>
      <div className="mt-auto pt-5">
        <Button
          type="button"
          variant={suggested ? "default" : "secondary"}
          disabled={disabled}
          onClick={onStart}
        >
          {busy ? "Starting…" : blank ? "New sheet" : "Start sheet"}
        </Button>
      </div>
    </li>
  );
}

function PlaybookPicker({
  prep,
  primary,
  person,
  playbooks,
  pointCount,
  startingId,
  onStart,
}: {
  prep: MeetingPrepDetail;
  primary: MeetingContextPerson | null;
  person: CallSheetPerson | null;
  playbooks: LiveScript[];
  pointCount: number;
  startingId: string | null;
  onStart: (playbook: LiveScript) => void;
}) {
  const now = useNow();
  const family = suggestedFamily(person?.networkingStatus ?? null, person?.touchCount ?? 0);
  const suggested = playbookFor(playbooks, family);
  const cards: LiveScript[] = [];
  if (suggested) cards.push(suggested);
  for (const item of CARD_FAMILIES) {
    if (cards.length >= 3) break;
    const playbook = playbookFor(playbooks, item);
    if (playbook && !cards.includes(playbook)) cards.push(playbook);
  }
  const blank = playbookFor(playbooks, "blank");
  if (blank) cards.push(blank);
  const others = playbooks.filter((playbook) => !cards.includes(playbook));

  const name = primary?.name || prep.primaryContactName || prep.title;
  const callType = person?.networkingStatus ? STATUS_LABELS[person.networkingStatus] : null;
  const line = [
    primary?.title,
    primary?.company ?? prep.primaryCompanyName,
    primary?.referredByName ? `introduced by ${primary.referredByName}` : null,
    callType,
    callNumberLabel(family, person?.touchNumber ?? 0),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-[1040px] px-10 py-10">
      <p className={KICKER}>
        <CalendarBlank size={14} weight="duotone" className="text-[var(--color-calendar)]" aria-hidden />
        {kickerParts(prep, now, null).join(" · ")}
      </p>
      <h1 className="mt-3 text-[44px] font-extrabold leading-[1.05] tracking-[-0.03em] break-words">{name}</h1>
      {line ? <p className="mt-2 text-[17px] text-[var(--jos-muted)]">{line}</p> : null}
      {name !== prep.title ? <p className="mt-1 text-[15px] text-[var(--jos-muted)]">{prep.title}</p> : null}

      <h2 className="mt-10 text-[24px] font-extrabold tracking-[-0.02em]">What kind of call is this?</h2>
      {pointCount ? (
        <p className="mt-1 text-[15px] text-[var(--jos-muted)]">
          This meeting already has {pointCount} point{pointCount === 1 ? "" : "s"}. They stay on the sheet.
        </p>
      ) : null}
      {cards.length ? (
        <ul className="mt-5 grid gap-4 min-[700px]:grid-cols-2 min-[1000px]:grid-cols-4">
          {cards.map((playbook) => (
            <PlaybookCard
              key={playbook.id}
              playbook={playbook}
              suggested={playbook === suggested}
              blank={playbook.family === "blank"}
              busy={startingId === playbook.id}
              disabled={startingId != null}
              onStart={() => onStart(playbook)}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-5 text-[15px] text-[var(--jos-muted)]">
          No playbooks yet. <Link href="/live/playbooks" className={LINK}>Add one</Link>
        </p>
      )}
      {others.length ? (
        <p className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-2 text-[15px]">
          <span className="text-[var(--jos-muted)]">Other playbooks</span>
          {others.map((playbook) => (
            <button
              key={playbook.id}
              type="button"
              className={LINK}
              disabled={startingId != null}
              onClick={() => onStart(playbook)}
            >
              {startingId === playbook.id ? "Starting…" : playbook.name}
            </button>
          ))}
        </p>
      ) : null}
    </div>
  );
}

/* ---------- 4b. Sheet header and view strip ---------- */

function ViewStrip({
  prepId,
  view,
  readyAt,
  debriefOpen,
  onView,
}: {
  prepId: string;
  view: CallSheetView;
  readyAt: string | null;
  debriefOpen: boolean;
  onView: (view: CallSheetView) => void;
}) {
  const tab = (active: boolean) =>
    cn(
      "-mb-px inline-flex items-center gap-1.5 border-b-[3px] px-1 pb-2.5 pt-3 text-[15px] font-semibold",
      active ? "border-[var(--color-accent-700)] text-[var(--jos-ink)]" : "border-transparent text-[var(--jos-muted)] hover:text-[var(--jos-ink)]"
    );
  const inRun = view === "rehearse" || view === "live";
  return (
    <nav
      aria-label="Call sheet views"
      className="flex flex-wrap items-end gap-x-7 border-b border-[var(--jos-line)] px-10"
    >
      <button
        type="button"
        className={tab(view === "read")}
        aria-current={view === "read" ? "page" : undefined}
        onClick={() => onView("read")}
      >
        {inRun ? "Back to sheet" : "Sheet"}
      </button>
      <button
        type="button"
        className={tab(view === "rehearse")}
        aria-current={view === "rehearse" ? "page" : undefined}
        onClick={() => onView("rehearse")}
      >
        Rehearse
      </button>
      <div className="mb-2.5 ml-auto flex flex-wrap items-center gap-x-5 gap-y-2">
        {debriefOpen || view === "debrief" ? (
          <button
            type="button"
            className={cn(
              "text-[13px] font-semibold",
              view === "debrief" ? "text-[var(--jos-ink)] underline" : "text-[var(--jos-muted)] hover:text-[var(--jos-ink)] hover:underline"
            )}
            aria-current={view === "debrief" ? "page" : undefined}
            onClick={() => onView("debrief")}
          >
            Debrief
          </button>
        ) : null}
        {view === "live" ? (
          <Link href={`/meetings/${prepId}/live`} className={LINK}>
            Full screen
          </Link>
        ) : null}
        <button
          type="button"
          disabled={!readyAt}
          title={readyAt ? "Marks and notes are saved to this call" : "Mark the sheet ready first"}
          aria-current={view === "live" ? "page" : undefined}
          onClick={() => onView("live")}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-[2px] px-3 text-[13px] font-bold",
            view === "live"
              ? "bg-[var(--color-accent-2)] text-white"
              : readyAt
                ? "border border-[var(--jos-line)] text-[var(--jos-ink)] hover:border-[var(--jos-ink)]"
                : "cursor-not-allowed border border-[var(--jos-line)] text-[var(--jos-muted)] opacity-55"
          )}
        >
          {readyAt ? null : <LockSimple size={14} weight="bold" aria-hidden />}
          {view === "live" ? "On the call" : "Run the call"}
        </button>
      </div>
    </nav>
  );
}

function SheetHeader({
  prep,
  primary,
  sheet,
  building,
  readyBusy,
  onBuild,
  onReady,
}: {
  prep: MeetingPrepDetail;
  primary: MeetingContextPerson | null;
  sheet: CallSheet;
  building: boolean;
  readyBusy: boolean;
  onBuild: () => void;
  onReady: () => void;
}) {
  const now = useNow();
  const join = joinHref(prep);
  const family = sheet.playbook?.family ?? null;
  const callLabel = callNumberLabel(family, sheet.person?.touchNumber ?? 0);
  const name = primary?.name || sheet.person?.name || prep.primaryContactName || prep.title;
  const contactId = primary?.contactId ?? sheet.person?.contactId ?? null;
  const playbookName = sheet.playbook ? sheet.playbook.name || FAMILY_LABELS[sheet.playbook.family] : null;
  const meta = [primary?.title, primary?.company ?? prep.primaryCompanyName, playbookName].filter(Boolean);
  return (
    <header className="px-10 pb-5 pt-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className={KICKER}>
            <CalendarBlank size={14} weight="duotone" className="text-[var(--color-calendar)]" aria-hidden />
            {kickerParts(prep, now, callLabel).join(" · ")}
          </p>
          <h1 className="mt-2 text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em] break-words">{name}</h1>
          <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-[16px] text-[var(--jos-muted)]">
            {meta.length ? <span>{meta.join(" · ")}</span> : null}
            {contactId ? (
              <>
                {meta.length ? <span aria-hidden>·</span> : null}
                <Link href={`/outreach/people?id=${contactId}`} className={LINK}>
                  Person
                </Link>
              </>
            ) : null}
          </p>
          {name !== prep.title ? <p className="mt-0.5 text-[14px] text-[var(--jos-muted)]">{prep.title}</p> : null}
          {prep.error ? (
            <p className="mt-2 text-[14px] font-medium text-[var(--color-accent-2-text)]">{prep.error}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" disabled={building} onClick={onBuild}>
            {building ? "Building…" : "Build from research"}
          </Button>
          {join ? (
            <a href={join} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "secondary" })}>
              Join
            </a>
          ) : null}
          <ReadyButton readyAt={sheet.readyAt} busy={readyBusy} onReady={onReady} />
        </div>
      </div>
    </header>
  );
}

/* ---------- Read view ---------- */

function useActiveBlock(blocks: CallSheetBlock[]): [string | null, (id: string) => void] {
  const [activeId, setActiveId] = useState<string | null>(null);
  const ids = blocks.map((block) => block.id).join(",");
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const sections = [...document.querySelectorAll<HTMLElement>("section[data-block-id]")];
    if (!sections.length) return;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.blockId;
          if (!id) continue;
          if (entry.isIntersecting) visible.set(id, entry.boundingClientRect.top);
          else visible.delete(id);
        }
        const top = [...visible.entries()].sort((a, b) => a[1] - b[1])[0];
        if (top) setActiveId(top[0]);
      },
      { rootMargin: "-20% 0px -55% 0px" }
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [ids]);
  return [activeId, setActiveId];
}

function MoreHistory({ prep, context }: { prep: MeetingPrepDetail; context: MeetingContext }) {
  return (
    <CollapsibleSection id={`${prep.id}-sheet-history`} label="More history" defaultOpen={false} className="mt-10">
      <div className="space-y-6">
        <div>
          <p className={LIVE_SECTION_LABEL}>How this meeting came about</p>
          {prep.emailContext ? (
            <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">{prep.emailContext}</p>
          ) : (
            <p className="mt-2 text-[14px] text-[var(--jos-muted)]">No email context yet.</p>
          )}
        </div>
        <div>
          <p className={LIVE_SECTION_LABEL}>Earlier meetings</p>
          {context.pastMeetings.length ? (
            <ul className="mt-2 space-y-3">
              {context.pastMeetings.map((meeting) => (
                <li key={meeting.id}>
                  <p className="text-[13px] font-semibold text-[var(--jos-muted)]">
                    {meeting.when ? easternDateLong(meeting.when) : "Past meeting"}
                  </p>
                  {meeting.title ? <p className="text-[15px] font-semibold">{meeting.title}</p> : null}
                  {meeting.nextStep ? (
                    <p className="mt-1 text-[14px]">
                      <span className="font-semibold">Next. </span>
                      {meeting.nextStep}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[14px] text-[var(--jos-muted)]">No earlier meetings on file.</p>
          )}
        </div>
        {context.recentEmail ? (
          <div>
            <p className={LIVE_SECTION_LABEL}>Latest email · {context.recentEmail.personName}</p>
            <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">{context.recentEmail.summary}</p>
            {context.recentEmail.threadUrl ? (
              <p className="mt-1">
                <ExternalLink href={context.recentEmail.threadUrl}>Open email</ExternalLink>
              </p>
            ) : null}
          </div>
        ) : null}
        {context.documents.length ? (
          <div>
            <p className={LIVE_SECTION_LABEL}>Documents</p>
            <ul className="mt-2 space-y-2 text-[15px]">
              {context.documents.map((document) => (
                <li key={document.id}>
                  {document.url ? (
                    <ExternalLink href={document.url}>{document.label}</ExternalLink>
                  ) : (
                    <span className="font-semibold">{document.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </CollapsibleSection>
  );
}

function ReadView({
  prep,
  context,
  primary,
  sheet,
  points,
  pointsError,
  pointCount,
  dirtyTitles,
  readyMessage,
  onSaved,
}: {
  prep: MeetingPrepDetail;
  context: MeetingContext;
  primary: MeetingContextPerson | null;
  sheet: CallSheet;
  points: MeetingPoint[];
  pointsError: string | null;
  pointCount: number;
  dirtyTitles: Set<string>;
  readyMessage: string | null;
  onSaved: (block: CallSheetBlock) => void;
}) {
  const [activeId, setActiveId] = useActiveBlock(sheet.blocks);
  const budget = sheet.playbook?.timeBudget ?? null;

  const body = (block: CallSheetBlock) => {
    switch (block.kind) {
      case "lines":
        return <LinesBlockBody block={block} onSaved={onSaved} />;
      case "points":
        return (
          <ConversationBlockBody
            prepId={prep.id}
            points={points}
            pointsError={pointsError}
            playbookId={sheet.playbook?.id ?? null}
          />
        );
      case "ask":
        return <AskBlockBody block={block} objections={sheet.playbook?.objections ?? []} onSaved={onSaved} />;
      case "after":
        return <AfterBlockBody />;
      default:
        return block.key === "who" ? (
          <WhoBlockBody
            block={block}
            prepId={prep.id}
            person={primary}
            researchRanAt={prep.researchRanAt}
            onSaved={onSaved}
          />
        ) : (
          <TextBlockBody block={block} onSaved={onSaved} />
        );
    }
  };

  return (
    <div className="mx-auto grid max-w-[1100px] gap-12 px-10 pb-24 pt-4 min-[1100px]:grid-cols-[minmax(0,700px)_300px]">
      <div className="min-w-0">
        {sheet.blocks.map((block, index) => (
          <BlockFrame
            key={block.id}
            block={block}
            number={index + 1}
            minutes={blockMinutes(block.key, budget)}
            needed={block.required && !blockIsFilled(block, pointCount)}
            onActive={() => setActiveId(block.id)}
          >
            {body(block)}
          </BlockFrame>
        ))}
        <MoreHistory prep={prep} context={context} />
      </div>
      <SheetRail
        blocks={sheet.blocks}
        activeId={activeId}
        pointCount={pointCount}
        dirtyTitles={dirtyTitles}
        readyAt={sheet.readyAt}
        readyMessage={readyMessage}
        onJump={(block) => {
          setActiveId(block.id);
          scrollToBlock(block);
        }}
      />
    </div>
  );
}

function sheetPersonName(prep: MeetingPrepDetail, primary: MeetingContextPerson | null, sheet: CallSheet): string {
  return primary?.name || sheet.person?.name || prep.primaryContactName || prep.title;
}

function useSheetPlay(
  prep: MeetingPrepDetail,
  primary: MeetingContextPerson | null,
  sheet: CallSheet,
  points: MeetingPoint[],
  mode: "live" | "rehearse"
) {
  const personName = sheetPersonName(prep, primary, sheet);
  return useMemo(
    () =>
      buildLiveSheet({
        blocks: sheet.blocks,
        playbook: sheet.playbook,
        touchNumber: sheet.person?.touchNumber ?? 0,
        personName,
        points,
        mode,
      }),
    [sheet.blocks, sheet.playbook, sheet.person?.touchNumber, personName, points, mode]
  );
}

function RehearseView({
  prep,
  primary,
  sheet,
  points,
  onDone,
}: {
  prep: MeetingPrepDetail;
  primary: MeetingContextPerson | null;
  sheet: CallSheet;
  points: MeetingPoint[];
  onDone: () => void;
}) {
  const { steps, feed } = useSheetPlay(prep, primary, sheet, points, "rehearse");
  return (
    <RehearseSheetClient
      title={prep.title}
      steps={steps}
      sheet={feed}
      backHref={`/meetings/${prep.id}`}
      embedded
      onEnded={onDone}
    />
  );
}

function LiveView({
  prep,
  primary,
  sheet,
  points,
  onStarted,
  onEnded,
}: {
  prep: MeetingPrepDetail;
  primary: MeetingContextPerson | null;
  sheet: CallSheet;
  points: MeetingPoint[];
  onStarted: (at: string) => void;
  onEnded: () => void;
}) {
  const { steps, feed } = useSheetPlay(prep, primary, sheet, points, "live");
  return (
    <LiveCallClient
      session={{
        title: prep.title,
        strategyName: feed.playbookName ?? prep.title,
        personLabel: feed.personName,
        companyLabel: primary?.company ?? prep.primaryCompanyName ?? null,
        timeLabel: `${easternClock(prep.startsAt)}–${easternClock(prep.endsAt)} ET`,
        joinHref: joinHref(prep),
        backHref: `/meetings/${prep.id}?view=debrief`,
        badge: "live",
        startedAt: prep.liveStartedAt,
        outcomeSentence: prep.outcomeSentence,
        onDone: "mark",
      }}
      points={steps}
      sheet={feed}
      embedded
      onEnded={onEnded}
      actions={{
        start: async () => {
          const result = await startLiveMeeting(prep.id);
          if (!result.ok) return result;
          onStarted(result.liveStartedAt);
          return { ok: true, startedAt: result.liveStartedAt };
        },
        setState: (id: string, state: PointState) => setMeetingPointState(id, state),
        setNote: (id: string, note: string) => setMeetingPointNote(id, note),
        end: () => endLiveMeeting(prep.id),
        markOutcome: (mark: OutcomeMark, note: string) => setMeetingOutcomeMark(prep.id, { mark, note }),
        setObservedReaction: (id: string, shape: ReactionShape | null) => setMeetingPointObservedReaction(id, shape),
      }}
    />
  );
}

/* ---------- Page ---------- */

interface CallSheetClientProps {
  prep: MeetingPrepDetail;
  context: MeetingContext;
  sheet: CallSheet | null;
  sheetError?: string | null;
  person: CallSheetPerson | null;
  playbooks: LiveScript[];
  points: MeetingPoint[];
  pointsError?: string | null;
  rubric: string[];
  review: MeetingReview | null;
  log?: RelationshipLogEntry | null;
  initialView?: CallSheetView;
}

export function CallSheetClient(props: CallSheetClientProps) {
  return (
    <LeaveGuardProvider>
      <CallSheetPage {...props} />
    </LeaveGuardProvider>
  );
}

function CallSheetPage({
  prep,
  context,
  sheet: serverSheet,
  sheetError,
  person,
  playbooks,
  points,
  pointsError,
  review,
  log = null,
  initialView = "read",
}: CallSheetClientProps) {
  const router = useRouter();
  const now = useNow();
  const { dirtyLabels, requestLeave } = useLeaveGuard();
  const [sheet, setSheet] = useState<CallSheet | null>(serverSheet);
  const [seenSheet, setSeenSheet] = useState(serverSheet);
  if (seenSheet !== serverSheet) {
    setSeenSheet(serverSheet);
    if (serverSheet) setSheet(serverSheet);
  }
  const [liveStartedAt, setLiveStartedAt] = useState(prep.liveStartedAt);
  const liveStarted = Boolean(liveStartedAt || prep.liveEndedAt);
  const meetingOver = now != null && Date.parse(prep.endsAt) < now;
  const debriefOpen = liveStarted || meetingOver || Boolean(log);
  const [view, setViewState] = useState<CallSheetView>(() => {
    if (initialView === "debrief" && !(liveStarted || log || Date.parse(prep.endsAt) < Date.now())) return "read";
    if (initialView === "live" && !serverSheet?.readyAt) return "read";
    return initialView;
  });
  const [startingId, setStartingId] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [readyBusy, setReadyBusy] = useState(false);

  const primary = primaryOf(prep, context);
  const pointCount = points.filter((point) => point.kind !== "agenda").length;
  const dirtyTitles = useMemo(() => new Set(dirtyLabels), [dirtyLabels]);
  const readyMessage = sheet
    ? unsavedProblem(dirtyLabels) ?? readyProblem(sheet.blocks, pointCount)
    : null;

  const showView = (next: CallSheetView) => {
    setViewState(next);
    const url = new URL(window.location.href);
    if (next === "read") url.searchParams.delete("view");
    else url.searchParams.set("view", next);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };

  const setView = (next: CallSheetView) => {
    if (next === view) return;
    // Rehearse and the real call don't hold sheet edits — leave them without a save prompt.
    if (view === "rehearse" || view === "live") {
      showView(next);
      return;
    }
    requestLeave(() => showView(next));
  };

  const liveEnded = () => {
    showView("debrief");
    router.refresh();
  };

  const onSaved = useCallback((block: CallSheetBlock) => {
    setSheet((current) => {
      if (!current) return current;
      const blocks = current.blocks.map((item) => (item.id === block.id ? block : item));
      const cleared = block.required && block.kind !== "points" && !blockIsFilled(block);
      return { ...current, blocks, readyAt: cleared ? null : current.readyAt };
    });
  }, []);

  const build = useCallback(() => {
    setBuilding(true);
    void buildCallSheet({ prepId: prep.id }).then((result) => {
      setBuilding(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSheet(result.sheet);
      const parts = ["Sheet built"];
      if (result.pointsAdded) parts.push(`${result.pointsAdded} point${result.pointsAdded === 1 ? "" : "s"} added`);
      if (!result.researchVerified) parts.push("research not verified");
      toast.success(parts.join(" · "));
      for (const warning of result.warnings.slice(0, 2)) toast.warning(warning);
      router.refresh();
    });
  }, [prep.id, router]);

  const start = (playbook: LiveScript) => {
    setStartingId(playbook.id);
    void createCallSheet({ prepId: prep.id, playbookId: playbook.id }).then((result) => {
      setStartingId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSheet(result.sheet);
      router.refresh();
      if (playbook.family !== "blank") build();
    });
  };

  const ready = () => {
    if (!sheet) return;
    const unsaved = unsavedProblem(dirtyLabels);
    const problem = unsaved ?? readyProblem(sheet.blocks, pointCount);
    if (problem) {
      toast.error(problem);
      const target = unsaved
        ? sheet.blocks.find((block) => dirtyTitles.has(block.title))
        : sheet.blocks.find((block) => block.required && !blockIsFilled(block, pointCount));
      if (target) {
        if (view !== "read") setViewState("read");
        window.setTimeout(() => scrollToBlock(target), 0);
      }
      return;
    }
    setReadyBusy(true);
    void markSheetReady(prep.id).then((result) => {
      setReadyBusy(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSheet((current) => (current ? { ...current, readyAt: result.readyAt } : current));
      toast.success("Sheet ready");
    });
  };

  return (
    <div className="min-h-[calc(100vh-var(--jos-nav-h))]">
      <LiveTertiaryNav />
      {!sheet ? (
        <>
          {sheetError ? (
            <p className="mx-10 mt-6 bg-[var(--color-accent-2-100)] px-3 py-2 text-[14px] font-semibold text-[var(--color-accent-2-text)]">
              {sheetError}
            </p>
          ) : null}
          <PlaybookPicker
            prep={prep}
            primary={primary}
            person={person}
            playbooks={playbooks}
            pointCount={pointCount}
            startingId={startingId}
            onStart={start}
          />
        </>
      ) : (
        <>
          {view === "live" || view === "rehearse" ? null : (
            <SheetHeader
              prep={prep}
              primary={primary}
              sheet={sheet}
              building={building}
              readyBusy={readyBusy}
              onBuild={build}
              onReady={ready}
            />
          )}
          <ViewStrip
            prepId={prep.id}
            view={view}
            readyAt={sheet.readyAt}
            debriefOpen={debriefOpen}
            onView={setView}
          />
          {building ? (
            <p
              role="status"
              className="border-b border-[var(--jos-line)] bg-[var(--jos-surface)] px-10 py-2.5 text-[14px] font-medium"
            >
              Building from research, email and the playbook. Lines you already saved stay as they are.
            </p>
          ) : null}
          {view === "read" ? (
            <ReadView
              prep={prep}
              context={context}
              primary={primary}
              sheet={sheet}
              points={points}
              pointsError={pointsError ?? null}
              pointCount={pointCount}
              dirtyTitles={dirtyTitles}
              readyMessage={readyMessage}
              onSaved={onSaved}
            />
          ) : view === "rehearse" ? (
            <RehearseView prep={prep} primary={primary} sheet={sheet} points={points} onDone={() => showView("read")} />
          ) : view === "live" ? (
            <LiveView
              prep={prep}
              primary={primary}
              sheet={sheet}
              points={points}
              onStarted={setLiveStartedAt}
              onEnded={liveEnded}
            />
          ) : (
            <CallSheetDebrief
              prep={prep}
              primary={primary}
              sheet={sheet}
              person={person}
              points={points}
              review={review}
              log={log}
              onSaved={onSaved}
            />
          )}
        </>
      )}
    </div>
  );
}

/* ---------- Sheet without a date ---------- */

function meetingLabel(meeting: MeetingPrepSummary): string {
  const when = new Date(meeting.startsAt).toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const person = meeting.primaryContactName?.trim() || meeting.title;
  return `${person} · ${when}`;
}

function UseForMeetingDialog({
  sheetId,
  meetings,
  open,
  onOpenChange,
}: {
  sheetId: string;
  meetings: MeetingPrepSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [prepId, setPrepId] = useState(meetings[0]?.id ?? "");
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [applying, setApplying] = useState(false);
  const selected = meetings.find((meeting) => meeting.id === prepId) ?? null;

  const run = () => {
    if (!prepId) return;
    setApplying(true);
    void putSheetOnMeeting({ sheetId, prepId }).then((result) => {
      setApplying(false);
      setConfirmReplace(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onOpenChange(false);
      router.push(`/meetings/${prepId}`);
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setConfirmReplace(false);
      }}
    >
      <DialogContent className="rounded-[2px] bg-[var(--jos-bg)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Use for a meeting</DialogTitle>
          <DialogDescription>Meetings in the next 14 days.</DialogDescription>
        </DialogHeader>
        {meetings.length === 0 ? (
          <p className="text-[14px] text-[var(--jos-muted)]">No meetings in the next 14 days.</p>
        ) : (
          <div className="space-y-4">
            <select
              aria-label="Meeting"
              value={prepId}
              className={cn(LIVE_FIELD, "h-11")}
              onChange={(event) => {
                setPrepId(event.target.value);
                setConfirmReplace(false);
              }}
            >
              {meetings.map((meeting) => (
                <option key={meeting.id} value={meeting.id}>
                  {meetingLabel(meeting)}
                </option>
              ))}
            </select>
            {confirmReplace && selected ? (
              <p className="text-[14px]">
                Replace {selected.pointCount} existing points?{" "}
                <button type="button" className={LINK} disabled={applying} onClick={run}>
                  Confirm
                </button>
                {" · "}
                <button type="button" className="font-semibold hover:underline" onClick={() => setConfirmReplace(false)}>
                  Cancel
                </button>
              </p>
            ) : (
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={!prepId || applying}
                  onClick={() => (selected && selected.pointCount > 0 ? setConfirmReplace(true) : run())}
                >
                  {applying ? "Putting it on…" : "Use for this meeting"}
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SheetPoints({ script, items }: { script: LiveScript; items: LiveScriptItem[] }) {
  return (
    <PointsEditor
      layout="outline"
      points={items}
      actions={{
        create: async (input) => {
          const result = await createLiveScriptItem({ scriptId: script.id, ...input });
          if (!result.ok) return result;
          return { ok: true, id: result.item.id };
        },
        update: (id, patch) => updateLiveScriptItem(id, patch),
        draftReactions: (id) => draftScriptItemReactions(id),
        remove: (id) => deleteLiveScriptItem(id),
        reorder: (ids) => reorderLiveScriptItems(script.id, ids),
      }}
    />
  );
}

function UnattachedReadView({
  sheet,
  script,
  items,
  dirtyTitles,
  readyMessage,
  onSaved,
}: {
  sheet: CallSheet | null;
  script: LiveScript;
  items: LiveScriptItem[];
  dirtyTitles: Set<string>;
  readyMessage: string;
  onSaved: (block: CallSheetBlock) => void;
}) {
  const blocks = sheet?.blocks ?? [];
  const [activeId, setActiveId] = useActiveBlock(blocks);
  const budget = sheet?.playbook?.timeBudget ?? null;
  const pointCount = items.filter((item) => item.kind !== "agenda").length;

  if (!sheet) {
    return (
      <div className="mx-auto max-w-[760px] px-10 pb-24 pt-6">
        <SheetPoints script={script} items={items} />
      </div>
    );
  }

  const body = (block: CallSheetBlock) => {
    switch (block.kind) {
      case "lines":
        return <LinesBlockBody block={block} onSaved={onSaved} />;
      case "points":
        return <SheetPoints script={script} items={items} />;
      case "ask":
        return <AskBlockBody block={block} objections={sheet.playbook?.objections ?? []} onSaved={onSaved} />;
      case "after":
        return <AfterBlockBody />;
      default:
        return <TextBlockBody block={block} onSaved={onSaved} />;
    }
  };

  return (
    <div className="mx-auto grid max-w-[1100px] gap-12 px-10 pb-24 pt-4 min-[1100px]:grid-cols-[minmax(0,700px)_300px]">
      <div className="min-w-0">
        {blocks.map((block, index) => (
          <BlockFrame
            key={block.id}
            block={block}
            number={index + 1}
            minutes={blockMinutes(block.key, budget)}
            needed={block.required && !blockIsFilled(block, pointCount)}
            onActive={() => setActiveId(block.id)}
          >
            {body(block)}
          </BlockFrame>
        ))}
      </div>
      <SheetRail
        blocks={blocks}
        activeId={activeId}
        pointCount={pointCount}
        dirtyTitles={dirtyTitles}
        readyAt={null}
        readyMessage={readyMessage}
        onJump={(block) => {
          setActiveId(block.id);
          scrollToBlock(block);
        }}
      />
    </div>
  );
}

function UnattachedRehearseView({
  sheet,
  script,
  items,
  onDone,
}: {
  sheet: CallSheet | null;
  script: LiveScript;
  items: LiveScriptItem[];
  onDone: () => void;
}) {
  const points = useMemo(() => scriptItemsAsPoints(items), [items]);
  const { steps, feed } = useMemo(
    () =>
      buildLiveSheet({
        blocks: sheet?.blocks ?? [],
        playbook: sheet?.playbook ?? null,
        touchNumber: 0,
        personName: script.name,
        points,
        mode: "rehearse",
      }),
    [sheet?.blocks, sheet?.playbook, script.name, points]
  );
  return (
    <RehearseSheetClient
      title={script.name}
      steps={steps}
      sheet={feed}
      backHref={`/live/sheets/${script.id}`}
      embedded
      onEnded={onDone}
    />
  );
}

interface UnattachedSheetClientProps {
  sheet: CallSheet | null;
  script: LiveScript;
  items: LiveScriptItem[];
  meetings: MeetingPrepSummary[];
  initialView?: "read" | "rehearse";
}

/** A sheet with no meeting yet. Points live on the sheet until it goes on a meeting. */
export function UnattachedSheetClient(props: UnattachedSheetClientProps) {
  return (
    <LeaveGuardProvider>
      <UnattachedSheetPage {...props} />
    </LeaveGuardProvider>
  );
}

function UnattachedSheetPage({
  sheet: serverSheet,
  script,
  items,
  meetings,
  initialView = "read",
}: UnattachedSheetClientProps) {
  const router = useRouter();
  const { dirtyLabels, requestLeave } = useLeaveGuard();
  const [sheet, setSheet] = useState<CallSheet | null>(serverSheet);
  const [seenSheet, setSeenSheet] = useState(serverSheet);
  if (seenSheet !== serverSheet) {
    setSeenSheet(serverSheet);
    setSheet(serverSheet);
  }
  const [view, setViewState] = useState<"read" | "rehearse">(initialView);
  const [useOpen, setUseOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const dirtyTitles = useMemo(() => new Set(dirtyLabels), [dirtyLabels]);
  const family = sheet?.playbook?.family ?? script.family;

  const showView = (next: "read" | "rehearse") => {
    setViewState(next);
    const url = new URL(window.location.href);
    if (next === "read") url.searchParams.delete("view");
    else url.searchParams.set("view", next);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };

  const onSaved = useCallback((block: CallSheetBlock) => {
    setSheet((current) =>
      current ? { ...current, blocks: current.blocks.map((item) => (item.id === block.id ? block : item)) } : current
    );
  }, []);

  const saveName = async (next: string): Promise<SaveOutcome<string>> => {
    const result = await updateLiveScript(script.id, { name: next });
    if (!result.ok) return result;
    router.refresh();
    return { ok: true, value: next };
  };

  const remove = () => {
    setDeleting(true);
    void deleteLiveScript(script.id).then((result) => {
      setDeleting(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push("/live");
      router.refresh();
    });
  };

  const tab = (active: boolean) =>
    cn(
      "-mb-px inline-flex items-center border-b-[3px] px-1 pb-2.5 pt-3 text-[15px] font-semibold",
      active
        ? "border-[var(--color-accent-700)] text-[var(--jos-ink)]"
        : "border-transparent text-[var(--jos-muted)] hover:text-[var(--jos-ink)]"
    );

  return (
    <div className="min-h-[calc(100vh-var(--jos-nav-h))]">
      <LiveTertiaryNav />
      {view === "read" ? (
        <header className="px-10 pb-5 pt-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className={KICKER}>
                <CalendarBlank size={14} weight="duotone" className="text-[var(--color-calendar)]" aria-hidden />
                Sheet without a date · {FAMILY_LABELS[family]}
              </p>
              <SavedTextField
                value={script.name}
                label="Sheet name"
                name="name"
                placeholder="Sheet name"
                maxLength={120}
                className="mt-2"
                inputClassName="h-auto py-1 text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em]"
                validate={(next) => (next ? null : "Name the sheet.")}
                onSave={saveName}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={() => setUseOpen(true)}>
                Use for a meeting
              </Button>
              {confirmDelete ? (
                <p className="text-[14px]">
                  Delete this sheet?{" "}
                  <button
                    type="button"
                    className="font-semibold text-[var(--color-accent-2-text)] hover:underline"
                    disabled={deleting}
                    onClick={remove}
                  >
                    {deleting ? "Deleting…" : "Delete"}
                  </button>
                  {" · "}
                  <button type="button" className="font-semibold hover:underline" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </button>
                </p>
              ) : (
                <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
              )}
            </div>
          </div>
        </header>
      ) : null}
      <nav aria-label="Sheet views" className="flex flex-wrap items-end gap-x-7 border-b border-[var(--jos-line)] px-10">
        {(["read", "rehearse"] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={tab(view === item)}
            aria-current={view === item ? "page" : undefined}
            onClick={() => {
              if (item === view) return;
              if (view === "rehearse") {
                showView(item);
                return;
              }
              requestLeave(() => showView(item));
            }}
          >
            {item === "read" ? (view === "rehearse" ? "Back to sheet" : "Sheet") : "Rehearse"}
          </button>
        ))}
      </nav>
      {view === "read" ? (
        <UnattachedReadView
          sheet={sheet}
          script={script}
          items={items}
          dirtyTitles={dirtyTitles}
          readyMessage={unsavedProblem(dirtyLabels) ?? "Put it on a meeting to mark it ready."}
          onSaved={onSaved}
        />
      ) : (
        <UnattachedRehearseView sheet={sheet} script={script} items={items} onDone={() => showView("read")} />
      )}
      <UseForMeetingDialog sheetId={script.id} meetings={meetings} open={useOpen} onOpenChange={setUseOpen} />
    </div>
  );
}
