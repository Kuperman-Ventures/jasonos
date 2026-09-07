"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { COPY_MACHINE } from "@/lib/iugr/copy";
import {
  APPARATUS,
  CHALLENGE,
  CONTINUE_LABEL,
  COPY_BODY,
  COPY_BODY_NO,
  COPY_BODY_UNSURE_SECOND,
  COUNT_ROW,
  PLATE_CAPTIONS,
  SILENT_SCREEN,
  copiesPeopleCount,
  dialNeedleAngle,
  formatCopiedShareLabel,
  leverCyForCount,
  nearestSnapFromLeverCy,
  nextSnapPoint,
  washAccentForCopies,
} from "@/lib/iugr/copyMachine";
import {
  MACHINE_DIALS,
  MACHINE_RETURN,
  type MachineDialDef,
} from "@/lib/iugr/machineDials";
import {
  evaluateScenario,
  type ScenarioAssumptions,
} from "@/lib/iugr/scenarioEngine";
import { ARCADE_SCRIPT, TRANSITION_5 } from "@/lib/iugr/script";
import {
  COPY_SNAP_POINTS,
  formatWholeNumber,
  nearestSnapPoint,
  type CopySnapPoint,
} from "@/lib/iugr/scenarioMath";
import type { ConsciousnessPremise } from "@/lib/iugr/types";
import { CopyField } from "@/components/iugr/CopyField";
import { Plate } from "@/components/iugr/plate/Plate";
import { TransitionBlock } from "@/components/iugr/TransitionBlock";

type CopyMachineChapterProps = {
  /** First visit after Original Town, or return visit after Three Doors. */
  visit: "first" | "return";
  consciousnessPremise: ConsciousnessPremise | null;
  readerFigureIndex: number | null;
  copiedTowns: number;
  hasInteracted: boolean;
  reachedNine: boolean;
  onCopiedTownsChange: (
    next: number,
    meta: { interacted: boolean; reachedNine: boolean },
  ) => void;
  assumptions?: ScenarioAssumptions;
  onAssumptionsChange?: (next: ScenarioAssumptions) => void;
  onContinue: () => void;
  onBack: () => void;
  reducedMotion: boolean;
};

const SESSION_SILENT_KEY = "iugr-copy-silent-seen";

function useCountUp(target: number, reducedMotion: boolean): number {
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);

  useEffect(() => {
    const from = displayRef.current;
    if (reducedMotion || from === target) {
      const id = requestAnimationFrame(() => {
        displayRef.current = target;
        setDisplay(target);
      });
      return () => cancelAnimationFrame(id);
    }
    const start = performance.now();
    const duration = Math.min(400, Math.max(150, Math.abs(target - from) * 40));
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) * (1 - t);
      const next = Math.round(from + (target - from) * eased);
      displayRef.current = next;
      setDisplay(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, reducedMotion]);

  return display;
}

function ChallengeStrip({
  copiedTowns,
  unavailable,
}: {
  copiedTowns: number;
  unavailable: boolean;
}) {
  if (unavailable) {
    return (
      <div className="iugr-copy-challenge is-unavailable" role="status">
        <ChallengeIcon kind="unavailable" />
        <div className="iugr-copy-challenge-copy">
          <span className="iugr-copy-challenge-label">
            {CHALLENGE.unavailableLabel}
          </span>
          <span className="iugr-copy-challenge-text">
            {CHALLENGE.unavailableText}
          </span>
        </div>
      </div>
    );
  }

  if (copiedTowns >= 9) {
    return (
      <div className="iugr-copy-challenge is-complete" role="status">
        <ChallengeIcon kind="check" />
        <div className="iugr-copy-challenge-copy">
          <span className="iugr-copy-challenge-label">
            {CHALLENGE.completeLabel}
          </span>
          <span className="iugr-copy-challenge-text">
            {CHALLENGE.completeText}
          </span>
        </div>
      </div>
    );
  }

  if (copiedTowns === 1) {
    return (
      <div className="iugr-copy-challenge is-even" role="status">
        <ChallengeIcon kind="clock" />
        <div className="iugr-copy-challenge-copy">
          <span className="iugr-copy-challenge-label">
            {CHALLENGE.evenLabel}
          </span>
          <span className="iugr-copy-challenge-text">{CHALLENGE.evenText}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="iugr-copy-challenge is-open" role="status">
      <ChallengeIcon kind="open" />
      <div className="iugr-copy-challenge-copy">
        <span className="iugr-copy-challenge-label">{CHALLENGE.openLabel}</span>
        <span className="iugr-copy-challenge-text">{CHALLENGE.openText}</span>
      </div>
    </div>
  );
}

function ChallengeIcon({
  kind,
}: {
  kind: "open" | "clock" | "check" | "unavailable";
}) {
  return (
    <svg
      className="iugr-copy-challenge-icon"
      viewBox="0 0 20 20"
      width="18"
      height="18"
      aria-hidden
    >
      {kind === "open" ? (
        <circle
          cx="10"
          cy="10"
          r="7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      ) : null}
      {kind === "clock" ? (
        <>
          <circle
            cx="10"
            cy="10"
            r="7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d="M10 6.5 V10 L13 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </>
      ) : null}
      {kind === "check" ? (
        <path
          d="M4.5 10.5 L8.2 14 L15.5 6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {kind === "unavailable" ? (
        <>
          <circle
            cx="10"
            cy="10"
            r="7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d="M7 7 L13 13 M13 7 L7 13"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </>
      ) : null}
    </svg>
  );
}

function ApparatusControl({
  copiedTowns,
  hasMovedLever,
  reducedMotion,
  onSetCopies,
  liveId,
}: {
  copiedTowns: number;
  hasMovedLever: boolean;
  reducedMotion: boolean;
  onSetCopies: (next: number, fromUser: boolean) => void;
  liveId: string;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragging = useRef(false);
  const dragMoved = useRef(false);
  const pointerStartY = useRef(0);
  const knobCy = leverCyForCount(copiedTowns);
  const angleDeg = dialNeedleAngle(copiedTowns);
  const angleRad = (angleDeg * Math.PI) / 180;
  const needleX =
    APPARATUS.dialCx + Math.cos(angleRad) * APPARATUS.dialNeedleLength;
  const needleY =
    APPARATUS.dialCy + Math.sin(angleRad) * APPARATUS.dialNeedleLength;

  const clientToSvgY = useCallback((clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return knobCy;
    const rect = svg.getBoundingClientRect();
    const y = ((clientY - rect.top) / rect.height) * 118;
    return y;
  }, [knobCy]);

  const applyFromClientY = useCallback(
    (clientY: number) => {
      const cy = clientToSvgY(clientY);
      onSetCopies(nearestSnapFromLeverCy(cy), true);
    },
    [clientToSvgY, onSetCopies],
  );

  const advanceOne = useCallback(() => {
    onSetCopies(nextSnapPoint(copiedTowns), true);
  }, [copiedTowns, onSetCopies]);

  useEffect(() => {
    if (!dragging.current) return;
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      if (Math.abs(e.clientY - pointerStartY.current) > 6) {
        dragMoved.current = true;
        applyFromClientY(e.clientY);
      }
    };
    const onUp = () => {
      // Button onPointerUp handles tap-vs-drag; this only clears stale drags.
      if (!dragging.current) return;
      dragging.current = false;
      dragMoved.current = false;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  });

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const snap = nearestSnapPoint(copiedTowns) as CopySnapPoint;
    const idx = COPY_SNAP_POINTS.indexOf(snap);
    if (e.key === "ArrowUp" || e.key === "ArrowRight") {
      e.preventDefault();
      const next = COPY_SNAP_POINTS[Math.min(COPY_SNAP_POINTS.length - 1, idx + 1)];
      onSetCopies(next, true);
    } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next = COPY_SNAP_POINTS[Math.max(0, idx - 1)];
      onSetCopies(next, true);
    } else if (e.key === "Home") {
      e.preventDefault();
      onSetCopies(0, true);
    } else if (e.key === "End") {
      e.preventDefault();
      onSetCopies(999, true);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      advanceOne();
    }
  };

  return (
    <div className="iugr-copy-apparatus-wrap" role="group" aria-label={COPY_MACHINE.machineAria}>
      <svg
        ref={svgRef}
        className="iugr-copy-apparatus"
        viewBox={APPARATUS.viewBox}
        width="100%"
        aria-hidden
      >
        <g
          fill="none"
          stroke="#F2EDE3"
          strokeWidth="1.4"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.85"
        >
          <rect x="52" y="16" width="150" height="72" rx="5" />
          <circle cx="79" cy="42" r="11" />
          <line x1="102" y1="34" x2="186" y2="34" />
          <line x1="102" y1="42" x2="186" y2="42" />
          <line x1="102" y1="50" x2="186" y2="50" />
          <path d="M84 88 L96 102 L158 102 L170 88" />
          <line x1="228" y1="20" x2="228" y2="84" />
          <line x1="222" y1="20" x2="234" y2="20" />
        </g>

        <line
          className="iugr-copy-dial-needle"
          x1={APPARATUS.dialCx}
          y1={APPARATUS.dialCy}
          x2={needleX}
          y2={needleY}
          stroke="#C8F04A"
          strokeWidth="1.4"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {!hasMovedLever ? (
          <g className="iugr-copy-annotations" aria-hidden>
            <circle
              cx="242"
              cy="78"
              r="1.6"
              fill="rgba(242,237,227,0.38)"
            />
            <line
              x1="242"
              y1="78"
              x2="268"
              y2="66"
              stroke="rgba(242,237,227,0.38)"
              strokeWidth="1"
            />
            <text
              x="272"
              y="64"
              className="iugr-copy-anno-text"
            >
              PULL
            </text>
          </g>
        ) : null}
      </svg>

      <button
        type="button"
        className={[
          "iugr-copy-lever-knob",
          reducedMotion ? "is-static" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ ["--lever-cy" as string]: `${knobCy}` }}
        aria-label={`Copied towns: ${formatWholeNumber(copiedTowns)}. Tap to advance one stop, or use arrow keys.`}
        aria-valuemin={0}
        aria-valuemax={999}
        aria-valuenow={copiedTowns}
        aria-valuetext={`${formatWholeNumber(copiedTowns)} copied towns`}
        aria-describedby={liveId}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          e.preventDefault();
          dragging.current = true;
          dragMoved.current = false;
          pointerStartY.current = e.clientY;
          (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          if (Math.abs(e.clientY - pointerStartY.current) > 6) {
            dragMoved.current = true;
            applyFromClientY(e.clientY);
          }
        }}
        onPointerUp={() => {
          if (dragging.current && !dragMoved.current) {
            advanceOne();
          }
          dragging.current = false;
          dragMoved.current = false;
        }}
      />
    </div>
  );
}

function CountRow({
  copiedTowns,
  consciousnessPremise,
  reducedMotion,
}: {
  copiedTowns: number;
  consciousnessPremise: ConsciousnessPremise | null;
  reducedMotion: boolean;
}) {
  const originals = 100;
  const copiesTarget = copiesPeopleCount(copiedTowns);
  const displayCopies = useCountUp(copiesTarget, reducedMotion);
  const shareLabel = formatCopiedShareLabel(copiedTowns);
  const muted = copiedTowns === 0;
  const strike = consciousnessPremise === "no";
  const unsureTick = consciousnessPremise === "unsure";
  const originalShare = copiedTowns === 0 ? 100 : 100 / (1 + copiedTowns);
  const copyShare = 100 - originalShare;

  return (
    <div className="iugr-copy-count-row">
      <div className="iugr-copy-count-groups">
        <div className="iugr-copy-count-group is-original">
          <span className="iugr-copy-count-label">{COUNT_ROW.originals}</span>
          <span className="iugr-copy-count-value is-chartreuse">
            {formatWholeNumber(originals)}
          </span>
        </div>
        <div className="iugr-copy-count-group">
          <span className="iugr-copy-count-label">{COUNT_ROW.copies}</span>
          <span
            className={[
              "iugr-copy-count-value",
              muted ? "is-muted" : "is-coral",
              strike ? "is-struck" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {formatWholeNumber(displayCopies)}
            {unsureTick ? (
              <sup className="iugr-copy-count-tick" aria-hidden>
                ?
              </sup>
            ) : null}
          </span>
        </div>
        <div className="iugr-copy-count-group is-share">
          <span className="iugr-copy-count-label">{COUNT_ROW.copiedShare}</span>
          <span
            className={[
              "iugr-copy-count-value",
              muted ? "is-muted" : "is-coral",
              strike ? "is-struck" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {shareLabel}
            {unsureTick ? (
              <sup className="iugr-copy-count-tick" aria-hidden>
                ?
              </sup>
            ) : null}
          </span>
        </div>
      </div>
      <div className="iugr-copy-proportion" aria-hidden>
        <span
          className="iugr-copy-proportion-original"
          style={{ width: `${originalShare}%` }}
        />
        <span
          className="iugr-copy-proportion-copy"
          style={{ width: `${copyShare}%` }}
        />
      </div>
    </div>
  );
}

function SilentScreen({
  onDismiss,
  reducedMotion,
}: {
  onDismiss: () => void;
  reducedMotion: boolean;
}) {
  useEffect(() => {
    const onKey = () => onDismiss();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  const cols = 34;
  const rows = 22;
  const cell = 8.6;
  const origin = 8;
  const readerCol = 16; // column 17, 0-indexed
  const readerRow = 10; // row 11, 0-indexed
  const readerCx = origin + readerCol * cell;
  const readerCy = origin + readerRow * cell;

  return (
    <div
      className={[
        "iugr-copy-silent",
        reducedMotion ? "is-static" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="dialog"
      aria-modal="true"
      aria-label="Silent screen"
      onClick={onDismiss}
      onKeyDown={(e) => {
        e.preventDefault();
        onDismiss();
      }}
      tabIndex={0}
    >
      <div className="iugr-copy-silent-inner">
        <svg
          className="iugr-copy-silent-field"
          viewBox="0 0 300 190"
          width="100%"
          aria-hidden
        >
          {Array.from({ length: cols * rows }, (_, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const cx = origin + col * cell;
            const cy = origin + row * cell;
            if (col === readerCol && row === readerRow) return null;
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r="2.4"
                fill="rgba(232,131,111,0.42)"
              />
            );
          })}
          <circle
            cx={readerCx}
            cy={readerCy}
            r="14"
            fill="none"
            stroke="rgba(200,240,74,0.28)"
            strokeWidth="1"
          />
          <circle
            cx={readerCx}
            cy={readerCy}
            r="8"
            fill="none"
            stroke="#C8F04A"
            strokeWidth="1.2"
          />
          <circle cx={readerCx} cy={readerCy} r="3.4" fill="#C8F04A" />
        </svg>
        <div className="iugr-copy-silent-lines">
          <p className="iugr-copy-silent-line1">{SILENT_SCREEN.line1}</p>
          <p className="iugr-copy-silent-line2">{SILENT_SCREEN.line2}</p>
        </div>
      </div>
      <p className="iugr-copy-silent-tap">{SILENT_SCREEN.tap}</p>
    </div>
  );
}


function MachineDial({
  dial,
  value,
  onChange,
}: {
  dial: MachineDialDef;
  value: string;
  onChange: (next: string) => void;
}) {
  const headingId = useId();
  return (
    <fieldset className="iugr-machine-dial" aria-labelledby={headingId}>
      <legend className="sr-only">{dial.title}</legend>
      <h3 className="iugr-machine-dial-title" id={headingId}>
        {dial.title}
      </h3>
      <div
        className="iugr-machine-dial-segments"
        role="radiogroup"
        aria-labelledby={headingId}
      >
        {dial.options.map((option) => {
          const selected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`iugr-machine-dial-segment${selected ? " is-selected" : ""}`}
              onClick={() => onChange(option.id)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function ReturnChallenge({
  readingId,
  foundUnsettled,
  foundCopiesWin,
}: {
  readingId: string;
  foundUnsettled: boolean;
  foundCopiesWin: boolean;
}) {
  if (!foundUnsettled) {
    return (
      <div className="iugr-copy-challenge is-open" role="status">
        <ChallengeIcon kind="open" />
        <div className="iugr-copy-challenge-copy">
          <span className="iugr-copy-challenge-label">
            {MACHINE_RETURN.challengeUnsettled[0]}
          </span>
          <span className="iugr-copy-challenge-text">
            {MACHINE_RETURN.challengeUnsettled[1]}
          </span>
        </div>
      </div>
    );
  }
  if (!foundCopiesWin) {
    const complete = readingId === "copies-win";
    return (
      <div
        className={`iugr-copy-challenge ${complete ? "is-complete" : "is-open"}`}
        role="status"
      >
        <ChallengeIcon kind={complete ? "check" : "open"} />
        <div className="iugr-copy-challenge-copy">
          <span className="iugr-copy-challenge-label">
            {complete ? "CHALLENGE COMPLETE" : MACHINE_RETURN.challengeCopiesWin[0]}
          </span>
          <span className="iugr-copy-challenge-text">
            {MACHINE_RETURN.challengeCopiesWin[1]}
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="iugr-copy-challenge is-complete" role="status">
      <ChallengeIcon kind="check" />
      <div className="iugr-copy-challenge-copy">
        <span className="iugr-copy-challenge-label">CHALLENGE COMPLETE</span>
        <span className="iugr-copy-challenge-text">
          {MACHINE_RETURN.challengeCopiesWin[1]}
        </span>
      </div>
    </div>
  );
}

export function CopyMachineChapter({
  visit,
  consciousnessPremise,
  readerFigureIndex,
  copiedTowns,
  hasInteracted,
  reachedNine,
  onCopiedTownsChange,
  assumptions,
  onAssumptionsChange,
  onContinue,
  onBack,
  reducedMotion,
}: CopyMachineChapterProps) {
  const liveId = useId();
  const [silentOpen, setSilentOpen] = useState(false);
  const [foundUnsettled, setFoundUnsettled] = useState(false);
  const [foundCopiesWin, setFoundCopiesWin] = useState(false);
  const isReturn = visit === "return";
  const wash = washAccentForCopies(copiedTowns);
  const snap = nearestSnapPoint(copiedTowns) as CopySnapPoint;
  const answerNo = consciousnessPremise === "no";
  const canContinueFirst = reachedNine || copiedTowns >= 9 || answerNo;

  const evaluation = useMemo(
    () => (assumptions ? evaluateScenario(assumptions) : null),
    [assumptions],
  );

  // Challenge progress from the live reading (and sticky once found).
  const liveUnsettled =
    foundUnsettled || evaluation?.readingId === "will-not-settle";
  const liveCopiesWin =
    foundCopiesWin || evaluation?.readingId === "copies-win";

  const maybeOpenSilent = useCallback((next: number) => {
    if (next < 999) return;
    try {
      if (sessionStorage.getItem(SESSION_SILENT_KEY) === "1") return;
      sessionStorage.setItem(SESSION_SILENT_KEY, "1");
    } catch {
      /* ignore */
    }
    setSilentOpen(true);
  }, []);

  const setCopies = useCallback(
    (raw: number, fromUser: boolean) => {
      const next = Math.max(0, Math.min(999, Math.round(raw)));
      onCopiedTownsChange(next, {
        interacted: fromUser || hasInteracted,
        reachedNine: reachedNine || next >= 9,
      });
      if (fromUser) maybeOpenSilent(next);
    },
    [hasInteracted, maybeOpenSilent, onCopiedTownsChange, reachedNine],
  );

  const bodyPrimary = answerNo
    ? COPY_BODY_NO
    : COPY_BODY[snap] ?? COPY_BODY[0];
  const bodySecond =
    !answerNo && consciousnessPremise === "unsure"
      ? COPY_BODY_UNSURE_SECOND
      : null;

  const liveText = `${formatWholeNumber(copiedTowns)} copied towns. ${bodyPrimary}`;

  const setDial = (id: keyof ScenarioAssumptions, next: string) => {
    if (!assumptions || !onAssumptionsChange) return;
    const updated = { ...assumptions, [id]: next } as ScenarioAssumptions;
    onAssumptionsChange(updated);
    const reading = evaluateScenario(updated).readingId;
    if (reading === "will-not-settle") setFoundUnsettled(true);
    if (reading === "copies-win") {
      setFoundUnsettled(true);
      setFoundCopiesWin(true);
    }
  };

  return (
    <section
      className="iugr-panel iugr-copy-machine"
      aria-labelledby="iugr-copy-title"
      style={{ ["--copy-wash" as string]: wash }}
      data-copies={copiedTowns}
      data-visit={visit}
    >
      <div className="iugr-label">
        {isReturn ? MACHINE_RETURN.chapterLabel : COPY_MACHINE.chapterLabel}
      </div>
      <h1 id="iugr-copy-title" className="iugr-headline iugr-headline-sm">
        {isReturn ? MACHINE_RETURN.title : COPY_MACHINE.title}
      </h1>

      {isReturn ? <p className="iugr-lead">{MACHINE_RETURN.welcome}</p> : null}

      {isReturn && evaluation ? (
        <ReturnChallenge
          readingId={evaluation.readingId}
          foundUnsettled={Boolean(liveUnsettled)}
          foundCopiesWin={Boolean(liveCopiesWin)}
        />
      ) : (
        <ChallengeStrip copiedTowns={copiedTowns} unavailable={answerNo} />
      )}

      <div className="iugr-copy-machine-strip">
        <Plate figureNumber={3} caption={PLATE_CAPTIONS.apparatus}>
          <ApparatusControl
            copiedTowns={copiedTowns}
            hasMovedLever={hasInteracted}
            reducedMotion={reducedMotion}
            onSetCopies={setCopies}
            liveId={liveId}
          />
        </Plate>
      </div>

      <CountRow
        copiedTowns={copiedTowns}
        consciousnessPremise={consciousnessPremise}
        reducedMotion={reducedMotion}
      />

      {isReturn && assumptions && onAssumptionsChange ? (
        <div className="iugr-machine-dials" aria-label={MACHINE_RETURN.dialsAria}>
          {MACHINE_DIALS.map((dial) => (
            <MachineDial
              key={dial.id}
              dial={dial}
              value={assumptions[dial.id]}
              onChange={(next) => setDial(dial.id, next)}
            />
          ))}
        </div>
      ) : null}

      <div className="iugr-copy-field-row" aria-label={COPY_MACHINE.clusterAria}>
        <CopyField
          copiedTowns={copiedTowns}
          readerFigureIndex={readerFigureIndex}
          consciousnessPremise={consciousnessPremise}
          reducedMotion={reducedMotion}
        />
      </div>

      {!isReturn ? (
        <div className="iugr-copy-body">
          <p>{bodyPrimary}</p>
          {bodySecond ? <p>{bodySecond}</p> : null}
        </div>
      ) : null}

      <div className="iugr-copy-snaps" role="group" aria-label="Quick copy counts">
        {COPY_SNAP_POINTS.map((p) => (
          <button
            key={p}
            type="button"
            className={[
              "iugr-copy-snap",
              copiedTowns === p ? "is-selected" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setCopies(p, true)}
            aria-pressed={copiedTowns === p}
          >
            {formatWholeNumber(p)}
          </button>
        ))}
      </div>

      {isReturn && evaluation ? (
        <aside
          className={[
            "iugr-machine-reading",
            `is-${evaluation.readingId}`,
            reducedMotion ? "is-static" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label={MACHINE_RETURN.outcomeAria}
        >
          <h2 className="iugr-machine-reading-title">
            {MACHINE_RETURN.outcomeTitle}
          </h2>
          <p className="iugr-machine-reading-label">{evaluation.label}</p>
          <p className="iugr-machine-reading-body" aria-live="polite">
            {evaluation.explanation}
          </p>
          <div className="iugr-machine-work">
            <h3>{MACHINE_RETURN.whatDidTheWorkTitle}</h3>
            <ul>
              {evaluation.whatDidTheWork.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
          <p className="iugr-machine-try">{MACHINE_RETURN.tryAnother}</p>
        </aside>
      ) : null}

      {isReturn ? (
        <div className="iugr-machine-closing-note">
          {ARCADE_SCRIPT.closingNote.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      ) : null}

      <p id={liveId} className="sr-only" aria-live="polite" aria-atomic="true">
        {isReturn && evaluation
          ? `${evaluation.label} ${evaluation.explanation}`
          : liveText}
      </p>

      {isReturn ? <TransitionBlock paragraphs={TRANSITION_5} /> : null}

      <div className="iugr-actions iugr-copy-nav">
        <button type="button" className="iugr-btn iugr-btn-ghost" onClick={onBack}>
          {isReturn ? MACHINE_RETURN.previousLabel : COPY_MACHINE.previousLabel}
        </button>
        <button
          type="button"
          className="iugr-btn iugr-btn-primary iugr-copy-continue"
          onClick={onContinue}
          disabled={isReturn ? false : !canContinueFirst}
        >
          {isReturn ? MACHINE_RETURN.continueLabel : CONTINUE_LABEL}
        </button>
      </div>

      {silentOpen ? (
        <SilentScreen
          reducedMotion={reducedMotion}
          onDismiss={() => setSilentOpen(false)}
        />
      ) : null}
    </section>
  );
}
