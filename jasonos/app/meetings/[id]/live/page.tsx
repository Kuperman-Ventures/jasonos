import Link from "next/link";
import { notFound } from "next/navigation";
import { easternClock, joinHref } from "@/components/jasonos/meeting-prep/meeting-prep-bits";
import { LiveCallClient } from "@/components/jasonos/meeting-prep/live-call-client";
import { loadMeetingContext } from "@/lib/meeting-prep/context";
import { buildLiveSheet } from "@/lib/meeting-prep/live-sheet";
import { getCallSheet } from "@/lib/server-actions/call-sheet";
import type { PointState } from "@/lib/meeting-prep/points";
import {
  endLiveMeeting,
  getMeetingPoints,
  setMeetingPointNote,
  setMeetingPointObservedReaction,
  setMeetingPointState,
  startLiveMeeting,
} from "@/lib/server-actions/meeting-points";
import type { ReactionShape } from "@/lib/meeting-prep/reactions";
import {
  getMeetingPrep,
  setMeetingOutcomeMark,
  type OutcomeMark,
} from "@/lib/server-actions/meeting-prep";

export const dynamic = "force-dynamic";

export default async function LiveMeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  async function start() {
    "use server";
    const result = await startLiveMeeting(id);
    if (!result.ok) return result;
    return { ok: true as const, startedAt: result.liveStartedAt };
  }

  async function setState(pointId: string, state: PointState) {
    "use server";
    return setMeetingPointState(pointId, state);
  }

  async function setNote(pointId: string, note: string) {
    "use server";
    return setMeetingPointNote(pointId, note);
  }

  async function end() {
    "use server";
    return endLiveMeeting(id);
  }

  async function markOutcome(mark: OutcomeMark, note: string) {
    "use server";
    return setMeetingOutcomeMark(id, { mark, note });
  }

  async function setObservedReaction(pointId: string, shape: ReactionShape | null) {
    "use server";
    return setMeetingPointObservedReaction(pointId, shape);
  }

  const [prepResult, pointsResult, context, sheetResult] = await Promise.all([
    getMeetingPrep(id),
    getMeetingPoints(id),
    loadMeetingContext(id).catch(() => null),
    getCallSheet({ prepId: id }),
  ]);
  if (!prepResult.ok) {
    if (prepResult.error === "Meeting prep not found.") notFound();
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-sm text-muted-foreground">{prepResult.error}</p>
      </div>
    );
  }
  if (!pointsResult.ok) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 px-4 py-6">
        <p className="text-sm text-muted-foreground">{pointsResult.error}</p>
        <Link
          href={`/meetings/${id}`}
          className="text-sm font-semibold text-[var(--color-accent-700)] hover:underline"
        >
          Back to the meeting
        </Link>
      </div>
    );
  }

  const prep = prepResult.prep;
  const person =
    context?.people.find((item) => item.contactId === prep.primaryContactId) ??
    context?.people[0] ??
    null;
  const personLabel =
    person?.name?.trim() ||
    prep.primaryContactName?.trim() ||
    prep.attendees.find((item) => item.name?.trim())?.name?.trim() ||
    prep.attendees[0]?.email ||
    null;
  const whoTheyAre =
    person?.packet
      ? {
          name: person.name,
          title: person.title,
          company: person.company,
          highlights: prep.packetHighlights,
          introReason: person.packet.introReason,
        }
      : null;
  const sheet = sheetResult.ok ? sheetResult.sheet : null;
  const played = sheet
    ? buildLiveSheet({
        blocks: sheet.blocks,
        playbook: sheet.playbook,
        touchNumber: sheet.person?.touchNumber ?? 0,
        personName: personLabel ?? sheet.person?.name ?? prep.title,
        points: pointsResult.points,
        mode: "live",
      })
    : null;
  return (
    <LiveCallClient
      session={{
        title: prep.title,
        strategyName: played?.feed.playbookName ?? prep.scriptName ?? prep.title,
        personLabel,
        companyLabel: person?.company ?? null,
        timeLabel: `${easternClock(prep.startsAt)}–${easternClock(prep.endsAt)} ET`,
        joinHref: joinHref(prep),
        backHref: played ? `/meetings/${prep.id}?view=debrief` : `/meetings/${prep.id}`,
        badge: "live",
        startedAt: prep.liveStartedAt,
        outcomeSentence: prep.outcomeSentence,
        onDone: "mark",
        whoTheyAre,
      }}
      points={played?.steps ?? pointsResult.points}
      sheet={played?.feed ?? null}
      actions={{ start, setState, setNote, end, markOutcome, setObservedReaction }}
    />
  );
}
