"use client";

import { GradeStrip } from "./GradeStrip";
import { recallSpanText } from "@/lib/activities-journal";

export type RecallAnswerState = {
  editing: boolean;
  pickMode: "start" | "end";
  since: number | null;
  until: number | null;
  stillDoing: boolean;
};

export function recallAsk(state: RecallAnswerState): string {
  if (state.since == null) return "What grade did you start?";
  if (!state.stillDoing && state.pickMode === "end") return "What grade did you stop?";
  return "Tap a different grade to change when you started.";
}

export function RecallAnswerCard({
  name,
  state,
  currentGrade,
  prompt,
  onRemove,
  onPick,
  onStill,
  onStopped,
  onDone,
  onChangeClick,
}: {
  name: string;
  state: RecallAnswerState;
  currentGrade: number | null;
  prompt?: string;
  onRemove: () => void;
  onPick: (grade: number) => void;
  onStill: () => void;
  onStopped: () => void;
  onDone?: () => void;
  onChangeClick: () => void;
}) {
  const open = state.editing || state.since == null;
  const ask = prompt ?? recallAsk(state);

  if (!open) {
    return (
      <li className="aj-recall-item is-closed">
        <div className="aj-recall-item-head">
          <span className="aj-recall-item-name">{name}</span>
          <button type="button" className="aj-text-btn" onClick={onRemove}>
            Remove
          </button>
        </div>
        <GradeStrip
          since={state.since}
          until={state.until}
          stillDoing={state.stillDoing}
          currentGrade={currentGrade}
          size="mini"
          label={name}
        />
        <p className="aj-recall-summary">
          <span>
            {state.since != null && currentGrade != null
              ? recallSpanText(state.since, state.until, state.stillDoing, currentGrade)
              : ""}
          </span>
          <button type="button" className="aj-text-btn" onClick={onChangeClick}>
            Change
          </button>
        </p>
      </li>
    );
  }

  return (
    <li className="aj-recall-item">
      <div className="aj-recall-item-head">
        <span className="aj-recall-item-name">{name}</span>
        <button type="button" className="aj-text-btn" onClick={onRemove}>
          Remove
        </button>
      </div>
      <p className="aj-recall-ask">{ask}</p>
      <GradeStrip
        since={state.since}
        until={state.until}
        stillDoing={state.stillDoing}
        currentGrade={currentGrade}
        size="pick"
        label={name}
        onPick={onPick}
      />
      <div className="aj-recall-pills" role="group" aria-label="Still doing it?">
        <button type="button" aria-pressed={state.stillDoing} onClick={onStill}>
          Still doing it
        </button>
        <button type="button" aria-pressed={!state.stillDoing} onClick={onStopped}>
          I stopped
        </button>
        {state.since != null ? (
          <button type="button" className="aj-text-btn" onClick={onDone}>
            Done
          </button>
        ) : null}
      </div>
    </li>
  );
}
