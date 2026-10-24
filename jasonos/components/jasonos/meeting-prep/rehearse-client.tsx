"use client";

import { useState } from "react";
import { LiveCallClient, type LiveCallActions } from "@/components/jasonos/meeting-prep/live-call-client";
import { Button } from "@/components/ui/button";
import type { LiveSheetFeed } from "@/lib/meeting-prep/live-sheet";
import type { PointState } from "@/lib/meeting-prep/points";
import type { ReactionShape } from "@/lib/meeting-prep/reactions";
import type { MeetingPoint } from "@/lib/server-actions/meeting-points";
import type { LiveScript, LiveScriptItem } from "@/lib/server-actions/live-scripts";

/** Script items in the shape the call screen plays. */
export function scriptItemsAsPoints(items: LiveScriptItem[]): MeetingPoint[] {
  return items.map((item) => ({
    id: item.id,
    prepId: "",
    position: item.position,
    kind: item.kind,
    headline: item.headline,
    detail: item.detail,
    state: "open" as const,
    stateChangedAt: null,
    confirmedState: null,
    confirmedAt: null,
    listenFor: item.listenFor ?? null,
    note: null,
    source: "script" as const,
    editedByUser: false,
    sourceHint: null,
    prepareReactions: item.prepareReactions,
    reactions: item.reactions,
    observedReaction: null,
  }));
}

/** Rehearsal starts every point open with no note or reaction. */
function freshSteps(steps: MeetingPoint[]): MeetingPoint[] {
  return steps.map((point) => ({
    ...point,
    state: "open",
    stateChangedAt: null,
    confirmedState: null,
    confirmedAt: null,
    note: null,
    observedReaction: null,
  }));
}

/** Rehearsal never writes to the server. */
function useLocalRun(initial: () => MeetingPoint[]) {
  const [points, setPoints] = useState(initial);
  const [clockKey, setClockKey] = useState(0);
  const reset = () => {
    setPoints(initial());
    setClockKey((key) => key + 1);
  };
  const actions: LiveCallActions = {
    setState: async (id, state: PointState) => {
      setPoints((current) =>
        current.map((point) =>
          point.id === id
            ? { ...point, state, stateChangedAt: state === "open" ? null : new Date().toISOString() }
            : point
        )
      );
      return { ok: true };
    },
    setNote: async (id, note) => {
      const value = note.trim() ? note.trim() : null;
      setPoints((current) => current.map((point) => (point.id === id ? { ...point, note: value } : point)));
      return { ok: true };
    },
    end: async () => ({ ok: true }),
    setObservedReaction: async (id, shape: ReactionShape | null) => {
      setPoints((current) =>
        current.map((point) => (point.id === id ? { ...point, observedReaction: shape } : point))
      );
      return { ok: true };
    },
  };
  return { points, clockKey, reset, actions };
}

function DrillToggle({ drill, setDrill }: { drill: boolean; setDrill: (on: boolean) => void }) {
  return (
    <Button type="button" variant={drill ? "default" : "secondary"} size="sm" onClick={() => setDrill(!drill)}>
      Drill
    </Button>
  );
}

export function RehearseClient({
  script,
  items,
}: {
  script: LiveScript;
  items: LiveScriptItem[];
}) {
  const run = useLocalRun(() => scriptItemsAsPoints(items));

  return (
    <LiveCallClient
      key={run.clockKey}
      session={{
        title: script.name,
        strategyName: script.name,
        personLabel: null,
        companyLabel: null,
        timeLabel: null,
        joinHref: null,
        backHref: `/live/playbooks/${script.id}`,
        badge: "rehearsal",
        startedAt: null,
        outcomeSentence: null,
        onDone: "none",
      }}
      points={run.points}
      onReset={run.reset}
      actions={run.actions}
      extraControls={DrillToggle}
    />
  );
}

/** Rehearse a call sheet: its points, then the ask and close, with every block in the rail. */
export function RehearseSheetClient({
  title,
  steps,
  sheet,
  backHref,
  embedded = false,
  onEnded,
}: {
  title: string;
  /** Conversation points followed by the Then steps, from liveSteps(). */
  steps: MeetingPoint[];
  sheet: LiveSheetFeed;
  backHref: string;
  embedded?: boolean;
  onEnded?: () => void;
}) {
  const run = useLocalRun(() => freshSteps(steps));

  return (
    <LiveCallClient
      key={run.clockKey}
      session={{
        title,
        strategyName: sheet.playbookName ?? title,
        personLabel: sheet.personName,
        companyLabel: null,
        timeLabel: null,
        joinHref: null,
        backHref,
        badge: "rehearsal",
        startedAt: null,
        outcomeSentence: null,
        onDone: "none",
      }}
      points={run.points}
      onReset={run.reset}
      actions={run.actions}
      extraControls={DrillToggle}
      sheet={sheet}
      embedded={embedded}
      onEnded={onEnded}
    />
  );
}
