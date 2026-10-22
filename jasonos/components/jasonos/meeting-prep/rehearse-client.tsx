"use client";

import { useState } from "react";
import { LiveCallClient } from "@/components/jasonos/meeting-prep/live-call-client";
import { Button } from "@/components/ui/button";
import type { PointState } from "@/lib/meeting-prep/points";
import type { ReactionShape } from "@/lib/meeting-prep/reactions";
import type { MeetingPoint } from "@/lib/server-actions/meeting-points";
import type { LiveScript, LiveScriptItem } from "@/lib/server-actions/live-scripts";

function toPoints(items: LiveScriptItem[]): MeetingPoint[] {
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

export function RehearseClient({
  script,
  items,
}: {
  script: LiveScript;
  items: LiveScriptItem[];
}) {
  const fresh = toPoints(items);
  const [points, setPoints] = useState(fresh);
  const [clockKey, setClockKey] = useState(0);

  const reset = () => {
    setPoints(toPoints(items));
    setClockKey((key) => key + 1);
  };

  return (
    <LiveCallClient
      key={clockKey}
      session={{
        title: script.name,
        strategyName: script.name,
        personLabel: null,
        companyLabel: null,
        timeLabel: null,
        joinHref: null,
        backHref: `/live/scripts/${script.id}`,
        badge: "rehearsal",
        startedAt: null,
        outcomeSentence: null,
        onDone: "none",
      }}
      points={points}
      onReset={reset}
      actions={{
        setState: async (id, state: PointState) => {
          setPoints((current) =>
            current.map((point) =>
              point.id === id
                ? {
                    ...point,
                    state,
                    stateChangedAt: state === "open" ? null : new Date().toISOString(),
                  }
                : point
            )
          );
          return { ok: true };
        },
        setNote: async (id, note) => {
          const value = note.trim() ? note.trim() : null;
          setPoints((current) =>
            current.map((point) => (point.id === id ? { ...point, note: value } : point))
          );
          return { ok: true };
        },
        end: async () => ({ ok: true }),
        setObservedReaction: async (id, shape: ReactionShape | null) => {
          setPoints((current) =>
            current.map((point) => (point.id === id ? { ...point, observedReaction: shape } : point))
          );
          return { ok: true };
        },
      }}
      extraControls={({ drill, setDrill }) => (
        <Button
          type="button"
          variant={drill ? "default" : "secondary"}
          size="sm"
          onClick={() => setDrill(!drill)}
        >
          Drill
        </Button>
      )}
    />
  );
}
