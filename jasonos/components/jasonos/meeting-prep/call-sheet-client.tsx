"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarBlank, LockSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  CollapsibleSection,
  LIVE_SECTION_LABEL,
  LeaveGuardProvider,
  LiveTertiaryNav,
  useLeaveGuard,
} from "@/components/jasonos/live";
import { AfterTheCall } from "@/components/jasonos/meeting-prep/after-call";
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
import { FAMILY_LABELS, type PlaybookFamily } from "@/lib/meeting-prep/playbook-blocks";
import {
  buildCallSheet,
  createCallSheet,
  markSheetReady,
  type CallSheet,
  type CallSheetPerson,
} from "@/lib/server-actions/call-sheet";
import type { LiveScript } from "@/lib/server-actions/live-scripts";
import type { MeetingPoint } from "@/lib/server-actions/meeting-points";
import type { MeetingPrepDetail } from "@/lib/server-actions/meeting-prep";
import type { MeetingReview } from "@/lib/server-actions/meeting-reviews";
import { cn } from "@/lib/utils";

export type CallSheetView = "read" | "rehearse" | "debrief";

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
  view,
  readyAt,
  liveStarted,
  onView,
  onLive,
}: {
  view: CallSheetView;
  readyAt: string | null;
  liveStarted: boolean;
  onView: (view: CallSheetView) => void;
  onLive: () => void;
}) {
  const tab = (active: boolean, dimmed = false) =>
    cn(
      "-mb-px inline-flex items-center gap-1.5 border-b-[3px] px-1 pb-2.5 pt-3 text-[15px] font-semibold",
      active ? "border-[var(--color-accent-700)] text-[var(--jos-ink)]" : "border-transparent text-[var(--jos-muted)]",
      dimmed ? "cursor-not-allowed opacity-45" : !active && "hover:text-[var(--jos-ink)]"
    );
  return (
    <nav aria-label="Call sheet views" className="flex flex-wrap items-end gap-x-7 border-b border-[var(--jos-line)] px-10">
      <button type="button" className={tab(view === "read")} aria-current={view === "read" ? "page" : undefined} onClick={() => onView("read")}>
        Read
      </button>
      <button
        type="button"
        className={tab(view === "rehearse")}
        aria-current={view === "rehearse" ? "page" : undefined}
        onClick={() => onView("rehearse")}
      >
        Rehearse
      </button>
      <button
        type="button"
        className={tab(false, !readyAt)}
        disabled={!readyAt}
        title={readyAt ? undefined : "Mark ready first"}
        onClick={onLive}
      >
        {readyAt ? null : <LockSimple size={14} weight="bold" aria-hidden />}
        Live
        {readyAt ? null : <span className="text-[12px] font-medium">Mark ready first</span>}
      </button>
      <button
        type="button"
        className={tab(view === "debrief", !liveStarted)}
        disabled={!liveStarted}
        title={liveStarted ? undefined : "After the call"}
        aria-current={view === "debrief" ? "page" : undefined}
        onClick={() => onView("debrief")}
      >
        Debrief
      </button>
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

function RehearseView({ playbookId }: { playbookId: string | null }) {
  return (
    <div className="mx-auto max-w-[700px] px-10 py-12">
      <h2 className="text-[24px] font-extrabold tracking-[-0.02em]">Rehearse</h2>
      <p className="mt-2 text-[16px] leading-relaxed text-[var(--jos-muted)]">
        Rehearsing this sheet out loud comes next. Until then, run the playbook it came from.
      </p>
      {playbookId ? (
        <Link href={`/live/scripts/${playbookId}/rehearse`} className={cn(buttonVariants({ variant: "secondary" }), "mt-5")}>
          Rehearse the playbook
        </Link>
      ) : null}
    </div>
  );
}

function DebriefView({
  prep,
  context,
  points,
  rubric,
  review,
}: {
  prep: MeetingPrepDetail;
  context: MeetingContext;
  points: MeetingPoint[];
  rubric: string[];
  review: MeetingReview | null;
}) {
  if (!prep.liveEndedAt) {
    return (
      <div className="mx-auto max-w-[700px] px-10 py-12">
        <p className="text-[16px] text-[var(--jos-muted)]">The call is still going. Debrief opens when you end it.</p>
        <Link href={`/meetings/${prep.id}/live`} className={cn(buttonVariants({ variant: "secondary" }), "mt-4")}>
          Back to Live
        </Link>
      </div>
    );
  }
  const commitments = context.brief.commitments.map((item) => ({
    text: item.text,
    direction: item.direction,
    due: item.due,
    personName: item.personName,
    status: item.status,
  }));
  return (
    <div className="mx-auto max-w-[900px] px-10 py-8">
      <AfterTheCall
        prep={prep}
        points={points}
        rubric={rubric}
        review={review}
        commitments={commitments}
        nextTouch={null}
      />
    </div>
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
  rubric,
  review,
  initialView = "read",
}: CallSheetClientProps) {
  const router = useRouter();
  const { dirtyLabels, requestLeave } = useLeaveGuard();
  const [sheet, setSheet] = useState<CallSheet | null>(serverSheet);
  const [seenSheet, setSeenSheet] = useState(serverSheet);
  if (seenSheet !== serverSheet) {
    setSeenSheet(serverSheet);
    if (serverSheet) setSheet(serverSheet);
  }
  const liveStarted = Boolean(prep.liveStartedAt || prep.liveEndedAt);
  const [view, setViewState] = useState<CallSheetView>(
    initialView === "debrief" && !liveStarted ? "read" : initialView
  );
  const [startingId, setStartingId] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [readyBusy, setReadyBusy] = useState(false);

  const primary = primaryOf(prep, context);
  const pointCount = points.filter((point) => point.kind !== "agenda").length;
  const dirtyTitles = useMemo(() => new Set(dirtyLabels), [dirtyLabels]);
  const readyMessage = sheet
    ? unsavedProblem(dirtyLabels) ?? readyProblem(sheet.blocks, pointCount)
    : null;

  const setView = (next: CallSheetView) => {
    if (next === view) return;
    requestLeave(() => {
      setViewState(next);
      const url = new URL(window.location.href);
      if (next === "read") url.searchParams.delete("view");
      else url.searchParams.set("view", next);
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    });
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
          <SheetHeader
            prep={prep}
            primary={primary}
            sheet={sheet}
            building={building}
            readyBusy={readyBusy}
            onBuild={build}
            onReady={ready}
          />
          <ViewStrip
            view={view}
            readyAt={sheet.readyAt}
            liveStarted={liveStarted}
            onView={setView}
            onLive={() => requestLeave(() => router.push(`/meetings/${prep.id}/live`))}
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
            <RehearseView playbookId={sheet.playbook?.id ?? null} />
          ) : (
            <DebriefView prep={prep} context={context} points={points} rubric={rubric} review={review} />
          )}
        </>
      )}
    </div>
  );
}
